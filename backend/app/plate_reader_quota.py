from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AccessKey, AccessKeyStatus, Company, ContractStatus, PlateReaderMonthlyUsage, User, UserStatus
from .time_utils import now_local


PLATE_READER_MONTHLY_POOL = 2500
PLATE_READER_LOW_REMAINING_THRESHOLD = 25


@dataclass(frozen=True)
class PlateReaderQuotaSnapshot:
    monthly_pool: int
    active_user_count: int
    monthly_limit: int
    used_count: int
    remaining_count: int
    month_start: date

    @property
    def low_remaining_warning(self) -> bool:
        return self.remaining_count <= PLATE_READER_LOW_REMAINING_THRESHOLD


class PlateReaderQuotaError(RuntimeError):
    pass


class PlateReaderQuotaUnavailableError(PlateReaderQuotaError):
    pass


class PlateReaderQuotaExceededError(PlateReaderQuotaError):
    pass


def _current_month_start(reference_date: date | None = None) -> date:
    current_date = reference_date or now_local().date()
    return current_date.replace(day=1)


def _eligible_plate_reader_user_ids(db: Session) -> list[int]:
    stmt = (
        select(User.id)
        .join(Company, Company.id == User.company_id)
        .join(AccessKey, AccessKey.id == User.access_key_id)
        .where(User.is_master.is_(False))
        .where(User.user_status == UserStatus.ACTIVE.value)
        .where(Company.contract_status == ContractStatus.ACTIVE.value)
        .where(AccessKey.status == AccessKeyStatus.ACTIVE.value)
        .order_by(User.id.asc())
    )
    return list(db.scalars(stmt).all())


def _usage_rows_by_user_id(db: Session, month_start: date, user_ids: Iterable[int]) -> dict[int, PlateReaderMonthlyUsage]:
    normalized_ids = list(dict.fromkeys(user_ids))
    if not normalized_ids:
        return {}
    stmt = select(PlateReaderMonthlyUsage).where(
        PlateReaderMonthlyUsage.month_start == month_start,
        PlateReaderMonthlyUsage.user_id.in_(normalized_ids),
    )
    rows = db.scalars(stmt).all()
    return {row.user_id: row for row in rows}


def build_plate_reader_quota_snapshots(
    db: Session,
    *,
    user_ids: Iterable[int] | None = None,
    reference_date: date | None = None,
) -> dict[int, PlateReaderQuotaSnapshot]:
    eligible_user_ids = _eligible_plate_reader_user_ids(db)
    if not eligible_user_ids:
        return {}

    month_start = _current_month_start(reference_date)
    monthly_limit = PLATE_READER_MONTHLY_POOL // len(eligible_user_ids)
    selected_ids = set(user_ids) if user_ids is not None else set(eligible_user_ids)
    target_ids = [user_id for user_id in eligible_user_ids if user_id in selected_ids]
    usage_by_user_id = _usage_rows_by_user_id(db, month_start, target_ids)

    snapshots: dict[int, PlateReaderQuotaSnapshot] = {}
    for user_id in target_ids:
        usage_row = usage_by_user_id.get(user_id)
        used_count = usage_row.usage_count if usage_row is not None else 0
        remaining_count = max(0, monthly_limit - used_count)
        snapshots[user_id] = PlateReaderQuotaSnapshot(
            monthly_pool=PLATE_READER_MONTHLY_POOL,
            active_user_count=len(eligible_user_ids),
            monthly_limit=monthly_limit,
            used_count=used_count,
            remaining_count=remaining_count,
            month_start=month_start,
        )
    return snapshots


def get_plate_reader_quota_snapshot(
    db: Session,
    user: User,
    *,
    reference_date: date | None = None,
) -> PlateReaderQuotaSnapshot | None:
    if user.is_master:
        return None
    return build_plate_reader_quota_snapshots(
        db,
        user_ids=[user.id],
        reference_date=reference_date,
    ).get(user.id)


def ensure_plate_reader_quota_available(
    db: Session,
    user: User,
    *,
    reference_date: date | None = None,
) -> PlateReaderQuotaSnapshot | None:
    if user.is_master:
        return None

    snapshot = get_plate_reader_quota_snapshot(db, user, reference_date=reference_date)
    if snapshot is None:
        raise PlateReaderQuotaUnavailableError(
            "Leitura de placa disponivel apenas para usuarios com chave ativa."
        )
    if snapshot.remaining_count <= 0:
        raise PlateReaderQuotaExceededError(
            "Sua cota mensal de leitura de placas foi atingida. Aguarde a renovacao no proximo mes."
        )
    return snapshot


def register_plate_reader_usage(
    db: Session,
    user: User,
    *,
    reference_date: date | None = None,
) -> PlateReaderQuotaSnapshot | None:
    if user.is_master:
        return None

    snapshot = ensure_plate_reader_quota_available(db, user, reference_date=reference_date)
    month_start = snapshot.month_start
    usage_row = db.scalar(
        select(PlateReaderMonthlyUsage).where(
            PlateReaderMonthlyUsage.user_id == user.id,
            PlateReaderMonthlyUsage.month_start == month_start,
        )
    )
    if usage_row is None:
        usage_row = PlateReaderMonthlyUsage(
            user_id=user.id,
            month_start=month_start,
            usage_count=0,
        )
    usage_row.usage_count += 1
    db.add(usage_row)
    db.commit()

    return PlateReaderQuotaSnapshot(
        monthly_pool=snapshot.monthly_pool,
        active_user_count=snapshot.active_user_count,
        monthly_limit=snapshot.monthly_limit,
        used_count=usage_row.usage_count,
        remaining_count=max(0, snapshot.monthly_limit - usage_row.usage_count),
        month_start=month_start,
    )
