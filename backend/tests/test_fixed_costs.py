from __future__ import annotations

from datetime import date

from app.models import FixedCostEntry, FixedCostType


def test_fixed_cost_entries_support_date_range(client, master_auth_headers, db_session):
    rent = FixedCostType(company_id=1, name="Aluguel")
    internet = FixedCostType(company_id=1, name="Internet")
    db_session.add_all([rent, internet])
    db_session.flush()

    db_session.add_all(
        [
            FixedCostEntry(company_id=1, cost_type_id=rent.id, entry_date=date(2026, 5, 1), amount=800),
            FixedCostEntry(company_id=1, cost_type_id=internet.id, entry_date=date(2026, 5, 3), amount=120),
            FixedCostEntry(company_id=1, cost_type_id=internet.id, entry_date=date(2026, 4, 28), amount=90),
        ]
    )
    db_session.commit()

    response = client.get("/fixed-costs/entries?start=2026-05-01&end=2026-05-03", headers=master_auth_headers)

    assert response.status_code == 200
    payload = response.json()
    assert [item["entryDate"] for item in payload] == ["2026-05-03", "2026-05-01"]
    assert [item["costTypeName"] for item in payload] == ["Internet", "Aluguel"]


def test_fixed_cost_batch_rejects_retroactive_month(client, master_auth_headers):
    response = client.post(
        "/fixed-costs/entries/batch",
        headers=master_auth_headers,
        json={
            "entryDate": "2026-04-10",
            "items": [{"costTypeId": 1, "amount": 100}],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "So e permitido lancar custos fixos do mes vigente"