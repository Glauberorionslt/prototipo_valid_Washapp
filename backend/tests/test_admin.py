from __future__ import annotations

from app.models import AccessKey, AccessKeyStatus


def test_admin_system_overview_includes_users_and_orphan_keys(client, master_auth_headers, db_session, user_factory):
    user_factory(email="operacional-overview@example.com", with_access_key=True)
    orphan_key = AccessKey(key_token="ORPHAN-KEY", status=AccessKeyStatus.ACTIVE.value)
    db_session.add(orphan_key)
    db_session.commit()

    response = client.get("/admin/system/overview", headers=master_auth_headers)

    assert response.status_code == 200
    rows = response.json()
    assert any(row["rowType"] == "user" and row["email"] == "operacional-overview@example.com" for row in rows)
    assert any(row["rowType"] == "access-key" and row["keyToken"] == "ORPHAN-KEY" for row in rows)