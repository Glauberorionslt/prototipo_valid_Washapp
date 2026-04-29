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