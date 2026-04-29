from __future__ import annotations

from datetime import datetime

from app.models import Order, OrderStatus, WhatsAppLog
from app.whatsapp_client import WhatsAppResult


def test_notify_ready_marks_order_and_logs_sent_message(client, auth_headers, db_session, monkeypatch):
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

    monkeypatch.setattr(
        "app.routers.orders.send_text_message",
        lambda phone, text: WhatsAppResult(ok=True, detail="sent", provider_message_id="msg-123"),
    )

    response = client.post(f"/orders/{order.id}/notify-ready", headers=auth_headers)

    assert response.status_code == 200
    db_session.refresh(order)
    log = db_session.query(WhatsAppLog).filter(WhatsAppLog.order_id == order.id).one()
    assert order.notified_ready_at is not None
    assert log.status == "sent"
    assert log.provider_message_id == "msg-123"


def test_admin_whatsapp_relink_returns_502_when_bridge_reset_fails(client, master_auth_headers, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.admin.reset_bridge_session", lambda: {"ok": False, "detail": "bridge down"})

    response = client.post("/admin/whatsapp/relink", headers=master_auth_headers)

    assert response.status_code == 502
    assert response.json()["detail"] == "bridge down"