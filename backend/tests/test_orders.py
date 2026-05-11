from __future__ import annotations

from datetime import datetime

from app.models import Order, OrderStatus


def test_delivered_order_cannot_return_to_previous_status(client, auth_headers, db_session):
    order = Order(
        company_id=1,
        customer_name="Cliente Teste",
        phone="11999999999",
        vehicle="HB20",
        plate="ABC1234",
        color="Azul",
        wash_type="completa",
        base_price=50,
        total=80,
        status=OrderStatus.ENTREGUE.value,
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)

    response = client.put(
        f"/orders/{order.id}",
        json={"status": OrderStatus.AGUARDANDO.value},
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Ordem entregue nao pode ser alterada"


def test_marking_order_as_delivered_sets_delivered_at(client, auth_headers, db_session):
    order = Order(
        company_id=1,
        customer_name="Cliente Teste",
        phone="11999999999",
        vehicle="HB20",
        plate="ABC1234",
        color="Azul",
        wash_type="completa",
        base_price=50,
        total=80,
        status=OrderStatus.PRONTO.value,
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)

    response = client.put(
        f"/orders/{order.id}",
        json={"status": OrderStatus.ENTREGUE.value},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["deliveredAt"] is not None


def test_reserve_next_order_id_returns_next_sequence(client, auth_headers, db_session):
    existing_order = Order(
        company_id=1,
        customer_name="Cliente Base",
        phone="11999999999",
        vehicle="HB20",
        plate="AAA1234",
        color="Azul",
        wash_type="simples",
        base_price=30,
        total=30,
        status=OrderStatus.AGUARDANDO.value,
    )
    db_session.add(existing_order)
    db_session.commit()

    response = client.get("/orders/reserve-next-id", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["reservedOrderId"] == existing_order.id + 1
