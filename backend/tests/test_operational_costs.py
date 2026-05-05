from __future__ import annotations

from datetime import date

from app.models import OperationalCostEntry, OperationalCostType


def test_operational_cost_entries_support_date_range(client, master_auth_headers, db_session):
    fuel = OperationalCostType(company_id=1, name="Combustivel")
    water = OperationalCostType(company_id=1, name="Agua")
    db_session.add_all([fuel, water])
    db_session.flush()

    db_session.add_all(
        [
            OperationalCostEntry(company_id=1, cost_type_id=fuel.id, entry_date=date(2026, 5, 1), amount=50),
            OperationalCostEntry(company_id=1, cost_type_id=water.id, entry_date=date(2026, 5, 3), amount=30),
            OperationalCostEntry(company_id=1, cost_type_id=water.id, entry_date=date(2026, 4, 28), amount=10),
        ]
    )
    db_session.commit()

    response = client.get("/operational-costs/entries?start=2026-05-01&end=2026-05-03", headers=master_auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert [item["entryDate"] for item in payload] == ["2026-05-03", "2026-05-01"]
    assert [item["costTypeName"] for item in payload] == ["Agua", "Combustivel"]