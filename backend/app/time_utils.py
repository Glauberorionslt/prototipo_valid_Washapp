from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo


APP_TIMEZONE = ZoneInfo("America/Sao_Paulo")


def now_local() -> datetime:
    return datetime.now(APP_TIMEZONE)


def local_day_bounds(target_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(target_date, time.min, tzinfo=APP_TIMEZONE)
    end = datetime.combine(target_date, time.max, tzinfo=APP_TIMEZONE)
    return start, end