from __future__ import annotations

from collections.abc import Generator
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base, get_db
from app.main import app
from app.models import AccessKey, AccessKeyStatus, Company, ContractStatus, User, UserStatus
from app.security import hash_password


TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    future=True,
)
TestingSessionLocal = sessionmaker(bind=TEST_ENGINE, autoflush=False, autocommit=False, future=True)


def override_get_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def reset_database(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    monkeypatch.setattr("app.main.create_schema", lambda: None)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def user_factory(db_session: Session):
    def create_user(
        *,
        email: str = "user@example.com",
        password: str = "Senha123!",
        is_master: bool = False,
        contract_status: str = ContractStatus.ACTIVE.value,
        user_status: str = UserStatus.ACTIVE.value,
        key_status: str = AccessKeyStatus.ACTIVE.value,
        with_access_key: bool = False,
        activated: bool = True,
    ) -> User:
        company = Company(
            name="Empresa Teste",
            slug=f"empresa-teste-{email.split('@', 1)[0]}",
            contract_code=f"CTR-{email.split('@', 1)[0].upper()}",
            contract_status=contract_status,
            plan_name="Pago",
        )
        db_session.add(company)
        db_session.flush()

        access_key = None
        if with_access_key:
            access_key = AccessKey(
                key_token=f"KEY-{email.split('@', 1)[0].upper()}",
                status=key_status,
                used_at=datetime.utcnow() if activated else None,
            )
            db_session.add(access_key)
            db_session.flush()

        user = User(
            email=email,
            full_name="Usuario Teste",
            password_hash=hash_password(password),
            is_master=is_master,
            company_id=company.id,
            user_status=user_status,
            access_key_id=access_key.id if access_key else None,
            activated_at=datetime.utcnow() if activated else None,
        )
        db_session.add(user)
        db_session.flush()

        if access_key is not None:
            access_key.used_by_user_id = user.id
            db_session.add(access_key)

        db_session.commit()
        db_session.refresh(user)
        return user

    return create_user


@pytest.fixture
def auth_headers(client: TestClient, user_factory):
    user_factory(email="operacional@example.com", with_access_key=True)
    response = client.post(
        "/auth/login",
        json={"email": "operacional@example.com", "password": "Senha123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def master_auth_headers(client: TestClient, user_factory):
    user_factory(email="master@example.com", password="Master123!", is_master=True, with_access_key=False)
    response = client.post(
        "/auth/login",
        json={"email": "master@example.com", "password": "Master123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
