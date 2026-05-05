from __future__ import annotations

from datetime import date

from app.models import TeamCostEntry, TeamMember


def test_team_entries_support_date_range(client, master_auth_headers, db_session):
    joao = TeamMember(company_id=1, name="Joao")
    maria = TeamMember(company_id=1, name="Maria")
    db_session.add_all([joao, maria])
    db_session.flush()

    db_session.add_all(
        [
            TeamCostEntry(company_id=1, member_id=joao.id, entry_date=date(2026, 5, 1), amount=100, tip_amount=20),
            TeamCostEntry(company_id=1, member_id=maria.id, entry_date=date(2026, 5, 3), amount=110, tip_amount=15),
            TeamCostEntry(company_id=1, member_id=joao.id, entry_date=date(2026, 4, 25), amount=90, tip_amount=10),
        ]
    )
    db_session.commit()

    response = client.get("/team/entries?start=2026-05-01&end=2026-05-03", headers=master_auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert [item["entryDate"] for item in payload] == ["2026-05-03", "2026-05-01"]
    assert [item["memberName"] for item in payload] == ["Maria", "Joao"]