from __future__ import annotations

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
