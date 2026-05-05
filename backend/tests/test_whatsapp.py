from __future__ import annotations

from datetime import datetime

from app.models import Order, OrderStatus


def test_notify_ready_returns_410_when_feature_is_disabled(client, auth_headers, db_session):
    order = Order(
        company_id=1,
        customer_name="Cliente WhatsApp",
        phone="11999999999",
        vehicle="Onix",
        plate="WPP1234",
        color="Branco",
        wash_type="simples",
        base_price=35,
        total=35,
        status=OrderStatus.PRONTO.value,
        created_at=datetime.utcnow(),
    )
    db_session.add(order)
    db_session.commit()
    db_session.refresh(order)

    response = client.post(f"/orders/{order.id}/notify-ready", headers=auth_headers)

    assert response.status_code == 410
    assert response.json()["detail"] == "Funcionalidade de aviso foi desativada"


def test_admin_whatsapp_relink_is_disabled(client, master_auth_headers):
    response = client.post("/admin/whatsapp/relink", headers=master_auth_headers)

    assert response.status_code == 502
    assert response.json()["detail"] == "WhatsApp desativado neste ambiente"