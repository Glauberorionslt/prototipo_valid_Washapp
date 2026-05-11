from __future__ import annotations

from datetime import date, datetime

from app.models import OperationalCostEntry, Order, OrderStatus, TeamCostEntry, TeamMember


def test_finance_report_excludes_tips_from_team_cost_total(client, auth_headers, db_session):
    today = date.today()
    order = Order(
        company_id=1,
        customer_name="Cliente Financeiro",
        phone="11999999999",
        vehicle="Corolla",
        plate="FIN1234",
        color="Preto",
        wash_type="completa",
        base_price=100,
        total=150,
        status=OrderStatus.PRONTO.value,
        created_at=datetime.utcnow(),
    )
    member = TeamMember(company_id=1, name="Equipe A")
    db_session.add_all([order, member])
    db_session.flush()

    db_session.add(
        TeamCostEntry(
            company_id=1,
            member_id=member.id,
            entry_date=today,
            amount=40,
            tip_amount=10,
        )
    )
    db_session.add(
        OperationalCostEntry(
            company_id=1,
            cost_type_id=1,
            entry_date=today,
            amount=20,
        )
    )
    db_session.commit()

    response = client.get(f"/finance/report?start={today.isoformat()}&end={today.isoformat()}", headers=auth_headers)

    assert response.status_code == 200
    summary = response.json()["summary"]
    assert summary["totalAmount"] == 150.0
    assert summary["teamCostTotal"] == 40.0
    assert summary["operationalCostTotal"] == 20.0
    assert summary["netOperationalTotal"] == 90.0


def test_finance_report_includes_created_and_delivered_dates(client, auth_headers, db_session):
    delivered_at = datetime.utcnow()
    order = Order(
        company_id=1,
        customer_name="Cliente Analitico",
        phone="11999999999",
        vehicle="Corolla",
        plate="FIN4321",
        color="Branco",
        wash_type="simples",
        base_price=50,
        total=70,
        status=OrderStatus.ENTREGUE.value,
        created_at=datetime(2026, 5, 10, 9, 30),
        delivered_at=delivered_at,
    )
    db_session.add(order)
    db_session.commit()

    response = client.get("/finance/report", headers=auth_headers)

    assert response.status_code == 200
    row = response.json()["rows"][0]
    assert row["createdAt"].startswith("2026-05-10T09:30:00")
    assert row["deliveredAt"] is not None