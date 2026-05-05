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


def test_login_invalidates_previous_device_session(client, user_factory):
    user_factory(email="single-session@example.com", password="Senha123!", is_master=True, with_access_key=False)

    first_login = client.post(
        "/auth/login",
        json={"email": "single-session@example.com", "password": "Senha123!"},
    )
    second_login = client.post(
        "/auth/login",
        json={"email": "single-session@example.com", "password": "Senha123!"},
    )

    first_token = first_login.json()["access_token"]
    second_token = second_login.json()["access_token"]

    first_me = client.get("/auth/me", headers={"Authorization": f"Bearer {first_token}"})
    second_me = client.get("/auth/me", headers={"Authorization": f"Bearer {second_token}"})

    assert first_me.status_code == 401
    assert first_me.json()["detail"] == "Sessao encerrada por novo login em outro dispositivo"
    assert second_me.status_code == 200
