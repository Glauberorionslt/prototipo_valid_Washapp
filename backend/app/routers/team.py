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
from ..models import TeamCostEntry, TeamMember, User
from ..schemas import TeamCostBatchIn, TeamCostEntryOut, TeamCostEntryUpdate, TeamMemberCreate, TeamMemberOut, TeamMemberUpdate
from ..security import require_manager_password


router = APIRouter()


def _is_current_month(value: date) -> bool:
    today = date.today()
    return value.year == today.year and value.month == today.month


def _member_out(member: TeamMember) -> TeamMemberOut:
    return TeamMemberOut(id=member.id, name=member.name, isActive=member.is_active, createdAt=member.created_at)


def _entry_out(entry: TeamCostEntry) -> TeamCostEntryOut:
    return TeamCostEntryOut(
        id=entry.id,
        entryDate=entry.entry_date,
        memberId=entry.member_id,
        memberName=entry.member.name,
        amount=float(entry.amount),
        tipAmount=float(entry.tip_amount),
        totalAmount=round(float(entry.amount) + float(entry.tip_amount), 2),
        createdAt=entry.created_at,
        updatedAt=entry.updated_at,
    )


def _entries_stmt(company_id: int | None, entry_date: date | None, start: date | None, end: date | None):
    stmt = (
        select(TeamCostEntry)
        .join(TeamCostEntry.member)
        .where(TeamCostEntry.company_id == company_id)
    )
    if entry_date is not None:
        stmt = stmt.where(TeamCostEntry.entry_date == entry_date)
    if start is not None:
        stmt = stmt.where(TeamCostEntry.entry_date >= start)
    if end is not None:
        stmt = stmt.where(TeamCostEntry.entry_date <= end)
    return stmt.order_by(TeamCostEntry.entry_date.desc(), TeamMember.name)


@router.get("/members", response_model=list[TeamMemberOut])
def list_members(db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> list[TeamMemberOut]:
    members = db.scalars(select(TeamMember).where(
        TeamMember.company_id == user.company_id).order_by(TeamMember.name)).all()
    return [_member_out(member) for member in members]


@router.post("/members", response_model=TeamMemberOut, status_code=status.HTTP_201_CREATED)
def create_member(payload: TeamMemberCreate, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> TeamMemberOut:
    member = TeamMember(company_id=user.company_id or 0,
                        name=payload.name.strip())
    db.add(member)
    db.commit()
    db.refresh(member)
    return _member_out(member)


@router.put("/members/{member_id}", response_model=TeamMemberOut)
def update_member(member_id: int, payload: TeamMemberUpdate, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> TeamMemberOut:
    member = db.scalar(select(TeamMember).where(
        TeamMember.id == member_id, TeamMember.company_id == user.company_id))
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Membro nao encontrado")
    if payload.name is not None:
        member.name = payload.name.strip()
    if payload.isActive is not None:
        member.is_active = payload.isActive
    db.add(member)
    db.commit()
    db.refresh(member)
    return _member_out(member)


@router.delete("/members/{member_id}")
def delete_member(member_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> dict:
    member = db.scalar(select(TeamMember).where(
        TeamMember.id == member_id, TeamMember.company_id == user.company_id))
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Membro nao encontrado")
    db.delete(member)
    db.commit()
    return {"status": "deleted"}


@router.get("/entries", response_model=list[TeamCostEntryOut])
def list_entries(
    entry_date: date | None = Query(default=None, alias="entryDate"),
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_password),
) -> list[TeamCostEntryOut]:
    stmt = _entries_stmt(user.company_id, entry_date, start, end)
    entries = db.scalars(stmt).all()
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
                "Equipe": entry.member.name,
                "Valor": float(entry.amount),
                "Gorjeta": float(entry.tip_amount),
                "Total": round(float(entry.amount) + float(entry.tip_amount), 2),
            }
            for entry in entries
        ]
    )
    target = Path(tempfile.gettempdir()) / f"washapp2_equipe_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    dataframe.to_excel(target, index=False)
    return FileResponse(path=target, filename=target.name)


@router.post("/entries/batch", response_model=list[TeamCostEntryOut])
def save_entries(payload: TeamCostBatchIn, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> list[TeamCostEntryOut]:
    existing = db.scalars(select(TeamCostEntry).where(
        TeamCostEntry.company_id == user.company_id, TeamCostEntry.entry_date == payload.entryDate)).all()
    for entry in existing:
        db.delete(entry)
    db.flush()

    for item in payload.items:
        member = db.scalar(select(TeamMember).where(
            TeamMember.id == item.memberId, TeamMember.company_id == user.company_id))
        if member is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Membro nao encontrado para lancamento")
        db.add(
            TeamCostEntry(
                company_id=user.company_id or 0,
                member_id=member.id,
                entry_date=payload.entryDate,
                amount=item.amount,
                tip_amount=item.tipAmount,
            )
        )

    db.commit()
    entries = db.scalars(
        select(TeamCostEntry)
        .join(TeamCostEntry.member)
        .where(TeamCostEntry.company_id == user.company_id, TeamCostEntry.entry_date == payload.entryDate)
        .order_by(TeamMember.name)
    ).all()
    return [_entry_out(entry) for entry in entries]


@router.put("/entries/{entry_id}", response_model=TeamCostEntryOut)
def update_entry(entry_id: int, payload: TeamCostEntryUpdate, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> TeamCostEntryOut:
    entry = db.scalar(select(TeamCostEntry).join(TeamCostEntry.member).where(
        TeamCostEntry.id == entry_id, TeamCostEntry.company_id == user.company_id))
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Lancamento nao encontrado")
    if not _is_current_month(entry.entry_date):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="So e permitido alterar lancamentos do mes vigente")
    entry.amount = payload.amount
    entry.tip_amount = payload.tipAmount
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager_password)) -> dict:
    entry = db.scalar(select(TeamCostEntry).where(
        TeamCostEntry.id == entry_id, TeamCostEntry.company_id == user.company_id))
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Lancamento nao encontrado")
    if not _is_current_month(entry.entry_date):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="So e permitido alterar lancamentos do mes vigente")
    db.delete(entry)
    db.commit()
    return {"status": "deleted"}
