from __future__ import annotations

from app.models import Product


def test_list_products_filters_by_kind(client, auth_headers, db_session):
    db_session.add_all(
        [
            Product(company_id=1, name="Lavagem Executiva", price=80, product_kind="wash_type"),
            Product(company_id=1, name="Cera Premium", price=20, product_kind="addon"),
        ]
    )
    db_session.commit()

    response = client.get("/products?kind=wash_type", headers=auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["name"] == "Lavagem Executiva"
    assert payload[0]["kind"] == "wash_type"


def test_create_product_accepts_wash_type_kind(client, auth_headers):
    response = client.post(
        "/products",
        json={"name": "Lavagem Moto", "price": 25, "kind": "wash_type"},
        headers=auth_headers,
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["kind"] == "wash_type"
    assert payload["name"] == "Lavagem Moto"