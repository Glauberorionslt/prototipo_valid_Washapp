from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus

from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def _split_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret_key: str
    jwt_expire_minutes: int
    system_admin_password: str
    cors_origins: list[str]
    whatsapp_bridge_url: str | None
    whatsapp_timeout_seconds: int


def _build_database_url() -> str:
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit

    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "5433")
    db_name = os.getenv("DB_NAME", "washapp2")
    user = os.getenv("DB_USER", "postgres")
    password = quote_plus(os.getenv("DB_PASSWORD", ""))
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db_name}"


settings = Settings(
    database_url=_build_database_url(),
    jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me"),
    jwt_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "1440")),
    system_admin_password=os.getenv("SYSTEM_ADMIN_PASSWORD", "admin123"),
    cors_origins=_split_csv(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173",
        )
    ),
    whatsapp_bridge_url=os.getenv("WHATSAPP_BRIDGE_URL") or None,
    whatsapp_timeout_seconds=int(os.getenv("WHATSAPP_TIMEOUT_SECONDS", "10")),
)
