from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal, create_schema
from app.models import AppSetting, Customer, Order, Product


def main() -> None:
    create_schema()
    mock_path = Path(__file__).resolve().parent.parent / "wash-hub" / "src" / "data" / "mock.json"
    payload = json.loads(mock_path.read_text(encoding="utf-8"))

    with SessionLocal() as db:
        if not db.scalar(select(AppSetting).where(AppSetting.key == "shop_name")):
            db.add_all(
                [
                    AppSetting(key="shop_name", value=payload["currentUser"]["shop"]),
                    AppSetting(key="plan_name", value=payload["currentUser"]["plan"]),
                ]
            )

        existing_customers = {customer.name for customer in db.scalars(select(Customer)).all()}
        for customer in payload["customers"]:
            if customer["name"] in existing_customers:
                continue
            db.add(
                Customer(
                    name=customer["name"],
                    phone=customer.get("phone") or None,
                    vehicle=customer.get("vehicle") or None,
                    plate=customer.get("plate") or None,
                    color=customer.get("color") or None,
                    is_default=bool(customer.get("isDefault", False)),
                )
            )

        existing_products = {product.name for product in db.scalars(select(Product)).all()}
        for product in payload["products"]:
            if product["name"] in existing_products:
                continue
            db.add(Product(name=product["name"], price=product["price"]))

        existing_order_ids = {order.id for order in db.scalars(select(Order)).all()}
        for order in payload["orders"]:
            if order["id"] in existing_order_ids:
                continue
            db.add(
                Order(
                    id=order["id"],
                    customer_name=order["customerName"],
                    phone=order.get("phone"),
                    vehicle=order.get("vehicle"),
                    plate=order.get("plate"),
                    color=order.get("color"),
                    wash_type=order["washType"],
                    base_price=order["total"],
                    total=order["total"],
                    status=order["status"],
                    created_at=order["createdAt"],
                )
            )

        db.commit()

    print("Seed concluido a partir do mock do frontend.")


if __name__ == "__main__":
    main()
