from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
import tempfile

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FixedCostEntry, FixedCostType, User
from ..schemas import OperationalCostBatchIn, OperationalCostEntryOut, OperationalCostEntryUpdate, OperationalCostTypeCreate, OperationalCostTypeOut, OperationalCostTypeUpdate
from ..security import require_manager_password


router = APIRouter()


def _is_current_month(value: date) -> bool:
    today = date.today()
    return value.year == today.year and value.month == today.month


def _cost_type_out(cost_type: FixedCostType) -> OperationalCostTypeOut:
    return OperationalCostTypeOut(id=cost_type.id, name=cost_type.name, isActive=cost_type.is_active, createdAt=cost_type.created_at)


def _entry_out(entry: FixedCostEntry) -> OperationalCostEntryOut:
    return OperationalCostEntryOut(
        id=entry.id,
        entryDate=entry.entry_date,
        costTypeId=entry.cost_type_id,
        costTypeName=entry.cost_type.name,
        amount=float(entry.amount),
        createdAt=entry.created_at,
        updatedAt=entry.updated_at,
    )


def _entries_stmt(company_id: int | None, entry_date: date | None, start: date | None, end: date | None):
    stmt = (
        select(FixedCostEntry)
        .join(FixedCostEntry.cost_type)
        .where(FixedCostEntry.company_id == company_id)
    )
    if entry_date is not None:
        stmt = stmt.where(FixedCostEntry.entry_date == entry_date)
    if start is not None:
        stmt = stmt.where(FixedCostEntry.entry_date >= start)
    if end is not None:
        stmt = stmt.where(FixedCostEntry.entry_date <= end)
    return stmt.order_by(FixedCostEntry.entry_date.desc(), FixedCostType.name)


@router.get("/types", response_model=list[OperationalCostTypeOut])
def list_types(db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> list[OperationalCostTypeOut]:
    cost_types = db.scalars(
        select(FixedCostType).where(FixedCostType.company_id == user.company_id).order_by(FixedCostType.name)
    ).all()
    return [_cost_type_out(cost_type) for cost_type in cost_types]


@router.post("/types", response_model=OperationalCostTypeOut, status_code=status.HTTP_201_CREATED)
def create_type(payload: OperationalCostTypeCreate, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> OperationalCostTypeOut:
    cost_type = FixedCostType(company_id=user.company_id or 0, name=payload.name.strip())
    db.add(cost_type)
    db.commit()
    db.refresh(cost_type)
    return _cost_type_out(cost_type)


@router.put("/types/{cost_type_id}", response_model=OperationalCostTypeOut)
def update_type(cost_type_id: int, payload: OperationalCostTypeUpdate, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> OperationalCostTypeOut:
    cost_type = db.scalar(select(FixedCostType).where(FixedCostType.id == cost_type_id, FixedCostType.company_id == user.company_id))
    if cost_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de custo fixo nao encontrado")
    if payload.name is not None:
        cost_type.name = payload.name.strip()
    if payload.isActive is not None:
        cost_type.is_active = payload.isActive
    db.add(cost_type)
    db.commit()
    db.refresh(cost_type)
    return _cost_type_out(cost_type)


@router.delete("/types/{cost_type_id}")
def delete_type(cost_type_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> dict:
    cost_type = db.scalar(select(FixedCostType).where(FixedCostType.id == cost_type_id, FixedCostType.company_id == user.company_id))
    if cost_type is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de custo fixo nao encontrado")
    db.delete(cost_type)
    db.commit()
    return {"status": "deleted"}


@router.get("/entries", response_model=list[OperationalCostEntryOut])
def list_entries(
    entry_date: date | None = Query(default=None, alias="entryDate"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_password),
) -> list[OperationalCostEntryOut]:
    entries = db.scalars(_entries_stmt(user.company_id, entry_date, start, end)).all()
    return [_entry_out(entry) for entry in entries]


@router.get("/entries/export")
def export_entries(
    entry_date: date | None = Query(default=None, alias="entryDate"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_password),
) -> FileResponse:
    entries = db.scalars(_entries_stmt(user.company_id, entry_date, start, end)).all()
    dataframe = pd.DataFrame(
        [
            {
                "Data": entry.entry_date.strftime("%d/%m/%Y"),
                "Despesa Fixa": entry.cost_type.name,
                "Valor": float(entry.amount),
            }
            for entry in entries
        ]
    )
    target = Path(tempfile.gettempdir()) / f"washapp2_custos_fixos_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    dataframe.to_excel(target, index=False)
    return FileResponse(path=target, filename=target.name)


@router.post("/entries/batch", response_model=list[OperationalCostEntryOut])
def save_entries(payload: OperationalCostBatchIn, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> list[OperationalCostEntryOut]:
    if not _is_current_month(payload.entryDate):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="So e permitido lancar custos fixos do mes vigente")

    existing = db.scalars(
        select(FixedCostEntry).where(FixedCostEntry.company_id == user.company_id, FixedCostEntry.entry_date == payload.entryDate)
    ).all()
    for entry in existing:
        db.delete(entry)
    db.flush()

    for item in payload.items:
        cost_type = db.scalar(select(FixedCostType).where(FixedCostType.id == item.costTypeId, FixedCostType.company_id == user.company_id))
        if cost_type is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tipo de custo fixo nao encontrado para lancamento")
        db.add(FixedCostEntry(company_id=user.company_id or 0, cost_type_id=cost_type.id, entry_date=payload.entryDate, amount=item.amount))

    db.commit()
    entries = db.scalars(
        select(FixedCostEntry)
        .join(FixedCostEntry.cost_type)
        .where(FixedCostEntry.company_id == user.company_id, FixedCostEntry.entry_date == payload.entryDate)
        .order_by(FixedCostType.name)
    ).all()
    return [_entry_out(entry) for entry in entries]


@router.put("/entries/{entry_id}", response_model=OperationalCostEntryOut)
def update_entry(entry_id: int, payload: OperationalCostEntryUpdate, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> OperationalCostEntryOut:
    entry = db.scalar(
        select(FixedCostEntry).join(FixedCostEntry.cost_type).where(FixedCostEntry.id == entry_id, FixedCostEntry.company_id == user.company_id)
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lancamento nao encontrado")
    if not _is_current_month(entry.entry_date):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="So e permitido alterar lancamentos do mes vigente")
    entry.amount = payload.amount
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> dict:
    entry = db.scalar(select(FixedCostEntry).where(FixedCostEntry.id == entry_id, FixedCostEntry.company_id == user.company_id))
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lancamento nao encontrado")
    if not _is_current_month(entry.entry_date):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="So e permitido alterar lancamentos do mes vigente")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}