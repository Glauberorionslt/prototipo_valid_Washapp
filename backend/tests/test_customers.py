from __future__ import annotations


def test_create_customer_rejects_exact_duplicate(client, auth_headers):
    payload = {
        "name": "Mariana Souza",
        "phone": "(11) 98123-4501",
        "vehicle": "Honda Civic",
        "plate": "BRA2E19",
        "color": "Prata",
        "isDefault": False,
    }

    first = client.post("/customers", json=payload, headers=auth_headers)
    duplicate = client.post("/customers", json=payload, headers=auth_headers)

    assert first.status_code == 201
    assert duplicate.status_code == 400
    assert duplicate.json()["detail"] == "Ja existe um cliente com os mesmos dados"
