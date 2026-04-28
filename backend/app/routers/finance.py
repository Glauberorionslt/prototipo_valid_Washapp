from __future__ import annotations

from datetime import date, datetime, time
from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import OperationalCostEntry, Order, TeamCostEntry, User, WhatsAppLog
from ..schemas import FinanceReportOut, FinanceRowOut, FinanceSendWhatsappIn, FinanceSummaryOut
from ..security import get_current_user, require_manager_password
from ..whatsapp_client import send_text_message


router = APIRouter()


def _range_bounds(start: date | None, end: date | None) -> tuple[datetime | None, datetime | None]:
    start_dt = datetime.combine(start, time.min) if start else None
    end_dt = datetime.combine(end, time.max) if end else None
    return start_dt, end_dt


def _filtered_orders(db: Session, company_id: int, start: date | None, end: date | None, status_filter: str | None) -> list[Order]:
    stmt = select(Order).order_by(Order.created_at.desc())
    stmt = stmt.where(Order.company_id == company_id)
    start_dt, end_dt = _range_bounds(start, end)
    if start_dt is not None:
        stmt = stmt.where(Order.created_at >= start_dt)
    if end_dt is not None:
        stmt = stmt.where(Order.created_at <= end_dt)
    if status_filter and status_filter != "all":
        stmt = stmt.where(Order.status == status_filter)
    return db.scalars(stmt).all()


def _sum_team_costs(db: Session, company_id: int, start: date | None, end: date | None) -> float:
    stmt = select(func.coalesce(func.sum(TeamCostEntry.amount + TeamCostEntry.tip_amount), 0)).where(TeamCostEntry.company_id == company_id)
    if start is not None:
        stmt = stmt.where(TeamCostEntry.entry_date >= start)
    if end is not None:
        stmt = stmt.where(TeamCostEntry.entry_date <= end)
    return round(float(db.scalar(stmt) or 0), 2)


def _sum_operational_costs(db: Session, company_id: int, start: date | None, end: date | None) -> float:
    stmt = select(func.coalesce(func.sum(OperationalCostEntry.amount), 0)).where(OperationalCostEntry.company_id == company_id)
    if start is not None:
        stmt = stmt.where(OperationalCostEntry.entry_date >= start)
    if end is not None:
        stmt = stmt.where(OperationalCostEntry.entry_date <= end)
    return round(float(db.scalar(stmt) or 0), 2)


def _report_out(db: Session, company_id: int, orders: list[Order], start: date | None, end: date | None) -> FinanceReportOut:
    finalized = [order for order in orders if order.status in {"pronto", "entregue"}]
    total_amount = round(sum(float(order.total) for order in finalized), 2)
    team_cost_total = _sum_team_costs(db, company_id, start, end)
    operational_cost_total = _sum_operational_costs(db, company_id, start, end)
    return FinanceReportOut(
        summary=FinanceSummaryOut(
            totalAmount=total_amount,
            finalizedCount=len(finalized),
            teamCostTotal=team_cost_total,
            operationalCostTotal=operational_cost_total,
            netOperationalTotal=round(total_amount - team_cost_total - operational_cost_total, 2),
        ),
        rows=[
            FinanceRowOut(
                id=order.id,
                customerName=order.customer_name,
                phone=order.phone,
                vehicle=order.vehicle,
                plate=order.plate,
                status=order.status,
                total=float(order.total),
                createdAt=order.created_at,
            )
            for order in orders
        ],
    )


@router.get("/report", response_model=FinanceReportOut)
def report(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FinanceReportOut:
    if user.company_id is None:
        return _report_out(db, 0, [], start, end)
    return _report_out(db, user.company_id, _filtered_orders(db, user.company_id, start, end, status_filter), start, end)


@router.get("/export")
def export_excel(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_password),
) -> FileResponse:
    orders = _filtered_orders(db, user.company_id or 0, start, end, status_filter)[:100]
    data = [
        {
            "ID": order.id,
            "Cliente": order.customer_name,
            "Telefone": order.phone,
            "Veiculo": order.vehicle,
            "Placa": order.plate,
            "Status": order.status,
            "Valor": float(order.total),
            "Data": order.created_at.strftime("%d/%m/%Y %H:%M"),
        }
        for order in orders
    ]
    dataframe = pd.DataFrame(data)
    target = Path(tempfile.gettempdir()) / f"washapp2_financeiro_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    dataframe.to_excel(target, index=False)
    return FileResponse(path=target, filename=target.name)


@router.post("/send-whatsapp")
def send_whatsapp_report(
    payload: FinanceSendWhatsappIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_password),
) -> dict:
    report_data = _report_out(
        db,
        user.company_id or 0,
        _filtered_orders(db, user.company_id or 0, payload.start, payload.end, payload.status),
        payload.start,
        payload.end,
    )
    lines = [
        "Relatorio Financeiro Washapp2",
        f"Valor total: R$ {report_data.summary.totalAmount:.2f}",
        f"Equipe: R$ {report_data.summary.teamCostTotal:.2f}",
        f"Custos operacionais: R$ {report_data.summary.operationalCostTotal:.2f}",
        f"Custo operacional: R$ {report_data.summary.netOperationalTotal:.2f}",
        f"Ordens finalizadas: {report_data.summary.finalizedCount}",
        f"Linhas consideradas: {len(report_data.rows)}",
    ]
    result = send_text_message(payload.phone, "\n".join(lines))
    db.add(
        WhatsAppLog(
            company_id=user.company_id,
            phone=payload.phone,
            message="\n".join(lines),
            status="sent" if result.ok else "failed",
            provider_message_id=result.provider_message_id,
        )
    )
    db.commit()
    return {"status": "ok", "detail": result.detail}
