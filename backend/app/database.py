from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, future=True)
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_schema() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_post_create_migrations()


def _apply_post_create_migrations() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "companies" not in table_names:
        return

    ddl_statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS user_status VARCHAR(20) DEFAULT 'active'",
        "ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
        "ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
        "ALTER TABLE whatsapp_logs ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id)",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contract_code VARCHAR(50)",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contract_status VARCHAR(20) DEFAULT 'active'",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS whatsapp_sender_phone VARCHAR(20)",
        "ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100) DEFAULT 'Pago'",
        "ALTER TABLE customers DROP CONSTRAINT IF EXISTS uq_customer_plate",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_contract_code ON companies(contract_code)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_company_plate_idx ON customers(company_id, plate) WHERE plate IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_users_company_id ON users(company_id)",
        "CREATE INDEX IF NOT EXISTS ix_customers_company_id ON customers(company_id)",
        "CREATE INDEX IF NOT EXISTS ix_products_company_id ON products(company_id)",
        "CREATE INDEX IF NOT EXISTS ix_orders_company_id ON orders(company_id)",
        "CREATE INDEX IF NOT EXISTS ix_whatsapp_logs_company_id ON whatsapp_logs(company_id)",
        "ALTER TABLE team_cost_entries ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10, 2) DEFAULT 0",
    ]

    with engine.begin() as connection:
        for statement in ddl_statements:
            connection.execute(text(statement))

        company_row = connection.execute(
            text("SELECT id FROM companies ORDER BY id LIMIT 1")).first()
        if company_row is None:
            company_id = connection.execute(
                text(
                    "INSERT INTO companies (name, slug, plan_name, created_at, updated_at) "
                    "VALUES (:name, :slug, :plan_name, NOW(), NOW()) RETURNING id"
                ),
                {"name": "Empresa Padrao",
                    "slug": "empresa-padrao", "plan_name": "Pago"},
            ).scalar_one()
        else:
            company_id = int(company_row[0])

        connection.execute(
            text(
                "UPDATE companies "
                "SET contract_code = CONCAT('CTR-LEGACY-', LPAD(id::text, 6, '0')) "
                "WHERE contract_code IS NULL"
            )
        )
        connection.execute(text(
            "UPDATE companies SET contract_status = 'active' WHERE contract_status IS NULL"))
        connection.execute(
            text("UPDATE users SET user_status = 'active' WHERE user_status IS NULL"))

        connection.execute(text("UPDATE users SET company_id = :company_id WHERE company_id IS NULL"), {
                           "company_id": company_id})
        connection.execute(text("UPDATE customers SET company_id = :company_id WHERE company_id IS NULL"), {
                           "company_id": company_id})
        connection.execute(text("UPDATE products SET company_id = :company_id WHERE company_id IS NULL"), {
                           "company_id": company_id})
        connection.execute(text("UPDATE orders SET company_id = :company_id WHERE company_id IS NULL"), {
                           "company_id": company_id})
        connection.execute(text("UPDATE whatsapp_logs SET company_id = :company_id WHERE company_id IS NULL"), {
                           "company_id": company_id})
        connection.execute(
            text("UPDATE team_cost_entries SET tip_amount = 0 WHERE tip_amount IS NULL"))
