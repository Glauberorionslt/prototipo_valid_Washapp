from __future__ import annotations

from datetime import date

from app.models import OperationalCostEntry, OperationalCostType, TeamCostEntry, TeamMember


def test_team_export_supports_filtered_period(client, master_auth_headers, db_session):
    member = TeamMember(company_id=1, name="Joao")
    db_session.add(member)
    db_session.flush()
    db_session.add_all(
        [
            TeamCostEntry(company_id=1, member_id=member.id, entry_date=date(2026, 5, 2), amount=100, tip_amount=20),
            TeamCostEntry(company_id=1, member_id=member.id, entry_date=date(2026, 4, 1), amount=90, tip_amount=10),
        ]
    )
    db_session.commit()

    response = client.get("/team/entries/export?start=2026-05-01&end=2026-05-03", headers=master_auth_headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")


def test_operational_cost_export_supports_filtered_period(client, master_auth_headers, db_session):
    cost_type = OperationalCostType(company_id=1, name="Agua")
    db_session.add(cost_type)
    db_session.flush()
    db_session.add_all(
        [
            OperationalCostEntry(company_id=1, cost_type_id=cost_type.id, entry_date=date(2026, 5, 2), amount=30),
            OperationalCostEntry(company_id=1, cost_type_id=cost_type.id, entry_date=date(2026, 4, 1), amount=10),
        ]
    )
    db_session.commit()

    response = client.get("/operational-costs/entries/export?start=2026-05-01&end=2026-05-03", headers=master_auth_headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")