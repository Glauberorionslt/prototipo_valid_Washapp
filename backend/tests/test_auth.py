from __future__ import annotations


def test_login_returns_access_token_for_master_user(client, user_factory):
    user_factory(email="master@example.com", password="Master123!", is_master=True, with_access_key=False)

    response = client.post(
        "/auth/login",
        json={"email": "master@example.com", "password": "Master123!"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access_token"]
    assert payload["is_master"] is True
    assert payload["needs_key"] is False


def test_login_locks_account_after_four_invalid_attempts(client, user_factory):
    user_factory(email="lock@example.com", password="Senha123!", is_master=True, with_access_key=False)

    for _ in range(4):
        response = client.post(
            "/auth/login",
            json={"email": "lock@example.com", "password": "senha-errada"},
        )
        assert response.status_code == 400

    locked_response = client.post(
        "/auth/login",
        json={"email": "lock@example.com", "password": "Senha123!"},
    )

    assert locked_response.status_code == 403
    assert locked_response.json()["detail"] == "Conta bloqueada temporariamente"


def test_login_blocks_user_with_inactive_access_key(client, user_factory):
    user_factory(
        email="inactive-key@example.com",
        password="Senha123!",
        with_access_key=True,
        key_status="inactive",
    )

    response = client.post(
        "/auth/login",
        json={"email": "inactive-key@example.com", "password": "Senha123!"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Chave inativa"
