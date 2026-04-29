from __future__ import annotations

from datetime import datetime, timedelta
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import AccessKey, AccessKeyStatus, Company, ContractStatus, User, UserStatus
from ..schemas import ActivateKeyRequest, AdminOperationalAccessRequest, BootstrapMasterRequest, CurrentUserOut, LoginRequest, LoginResponse, PasswordRequest, PasswordResetRequest
from ..security import create_access_token, get_current_user, hash_password, verify_password


router = APIRouter()


def _slugify_company_name(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum()
                      else "-" for ch in value.strip())
    slug = "-".join(part for part in cleaned.split("-") if part)
    return slug or f"empresa-{uuid.uuid4().hex[:8]}"


def _generate_contract_code() -> str:
    return f"CTR-{datetime.utcnow():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def _create_company_for_user(db: Session, email: str, full_name: str | None) -> Company:
    base_name = (full_name or email.split("@", 1)[0]).strip() or "Nova Empresa"
    company = Company(
        name=base_name,
        slug=f"{_slugify_company_name(base_name)}-{uuid.uuid4().hex[:6]}",
        contract_code=_generate_contract_code(),
    )
    db.add(company)
    db.flush()
    return company


def _user_to_current_user(user: User, db: Session) -> CurrentUserOut:
    access_key = db.get(
        AccessKey, user.access_key_id) if user.access_key_id is not None else None
    return CurrentUserOut(
        id=user.id,
        name=user.full_name or user.email,
        role="System Admin" if user.is_master else "Admin Operacional",
        isMaster=user.is_master,
        managerPasswordConfigured=bool(user.manager_password_hash),
        shop=user.company.name if user.company else "Wash App",
        contractCode=user.company.contract_code if user.company else None,
        contractStatus=user.company.contract_status if user.company else None,
        userStatus=user.user_status,
        accessKeyStatus=access_key.status if access_key else None,
        plan=user.company.plan_name if user.company else "Pago",
        email=user.email,
        phone=user.phone,
        companyId=user.company_id,
    )


def _get_user_access_key(db: Session, user: User) -> AccessKey:
    if user.access_key_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Usuario nao possui chave vinculada")
    key = db.get(AccessKey, user.access_key_id)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Chave vinculada nao encontrada")
    if key.status != AccessKeyStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Chave inativa")
    return key


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Usuario ou senha invalidos")

    now = datetime.utcnow()
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Conta bloqueada temporariamente")

    if not verify_password(payload.password, user.password_hash):
        user.failed_attempts += 1
        if user.failed_attempts >= 4:
            user.failed_attempts = 0
            user.locked_until = now + timedelta(minutes=30)
        db.add(user)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Usuario ou senha invalidos")

    if user.user_status != UserStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")

    if not user.is_master:
        if user.company is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Empresa nao encontrada")
        if user.company.contract_status != ContractStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Contrato inativo")
        if user.access_key_id is not None:
            key = db.get(AccessKey, user.access_key_id)
            if key is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Chave vinculada nao encontrada")
            if key.status != AccessKeyStatus.ACTIVE.value:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Chave inativa")

    user.failed_attempts = 0
    user.locked_until = None
    db.add(user)
    db.commit()

    needs_key = (not user.is_master) and (
        user.activated_at is None or user.access_key_id is None)
    needs_manager_password = (not user.is_master) and (
        not needs_key) and (not user.manager_password_hash)

    return LoginResponse(
        access_token=create_access_token(str(user.id)),
        needs_key=needs_key,
        needs_manager_password=needs_manager_password,
        is_master=user.is_master,
        email=user.email,
        name=user.full_name,
    )


@router.get("/me", response_model=CurrentUserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> CurrentUserOut:
    return _user_to_current_user(user, db)


@router.post("/bootstrap-master")
def bootstrap_master(
    payload: BootstrapMasterRequest,
    db: Session = Depends(get_db),
    x_system_admin_password: str | None = Header(default=None),
) -> dict:
    if not x_system_admin_password or x_system_admin_password != settings.system_admin_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")

    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(
            email=email,
            full_name=payload.full_name,
            password_hash=hash_password(payload.password),
            is_master=True,
            activated_at=datetime.utcnow(),
        )
        company = _create_company_for_user(db, email, payload.full_name)
        user.company_id = company.id
    else:
        user.full_name = payload.full_name or user.full_name
        user.password_hash = hash_password(payload.password)
        user.is_master = True
        user.activated_at = user.activated_at or datetime.utcnow()
        if user.company_id is None:
            company = _create_company_for_user(db, email, payload.full_name)
            user.company_id = company.id
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"status": "ok", "userId": user.id, "email": user.email}


@router.post("/register")
def register(payload: BootstrapMasterRequest, db: Session = Depends(get_db)) -> dict:
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario ja existe")
    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        is_master=False,
        company_id=_create_company_for_user(db, email, payload.full_name).id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"status": "ok", "userId": user.id}


@router.post("/reset-password")
def reset_password(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> dict:
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Usuario nao encontrado")
    if user.is_master:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Recuperacao por chave indisponivel para usuario master")

    key = _get_user_access_key(db, user)
    if key.key_token != payload.accessKeyToken.strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Chave de acesso invalida")

    user.password_hash = hash_password(payload.password)
    user.failed_attempts = 0
    user.locked_until = None
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.post("/set-key")
def set_key(
    payload: ActivateKeyRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    key = db.scalar(select(AccessKey).where(
        AccessKey.key_token == payload.key_token.strip()))
    if key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chave nao encontrada")
    if key.status != AccessKeyStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Chave inativa")
    if key.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Chave ja utilizada")

    now = datetime.utcnow()
    key.used_at = now
    key.used_by_user_id = user.id
    user.access_key_id = key.id
    user.activated_at = now
    db.add_all([key, user])
    db.commit()
    return {"status": "ok"}


@router.post("/set-manager-password")
def set_manager_password(
    payload: PasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not user.is_master and (user.activated_at is None or user.access_key_id is None):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Valide a chave primeiro")
    user.manager_password_hash = hash_password(payload.password)
    user.manager_password_set_at = datetime.utcnow()
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.post("/verify-manager-password")
def verify_manager_password(
    payload: PasswordRequest,
    user: User = Depends(get_current_user),
) -> dict:
    if user.is_master:
        return {"status": "ok"}
    if not user.manager_password_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Senha gerencial nao cadastrada")
    if not verify_password(payload.password, user.manager_password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Senha gerencial invalida")
    return {"status": "ok"}


@router.post("/authorize-admin-operational")
def authorize_admin_operational_access(
    payload: AdminOperationalAccessRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.is_master:
        return {"status": "ok", "method": "master"}

    if not user.manager_password_hash:
        return {"status": "ok", "method": "open"}

    manager_password = payload.managerPassword.strip(
    ) if payload.managerPassword else None
    access_key_token = payload.accessKeyToken.strip() if payload.accessKeyToken else None

    if manager_password and verify_password(manager_password, user.manager_password_hash):
        return {"status": "ok", "method": "manager-password"}

    if access_key_token:
        key = _get_user_access_key(db, user)
        if key.key_token == access_key_token:
            return {"status": "ok", "method": "access-key"}

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                        detail="Senha gerencial ou chave de acesso invalida")


@router.post("/access-keys/generate")
def generate_access_key(db: Session = Depends(get_db), _: User = Depends(get_current_user)) -> dict:
    token = str(uuid.uuid4())
    key = AccessKey(key_token=token)
    db.add(key)
    db.commit()
    db.refresh(key)
    return {"keyToken": key.key_token, "id": key.id}
