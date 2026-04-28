from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AccessKey, AccessKeyStatus, Company, ContractStatus, User, UserStatus
from ..schemas import AccessKeyCreate, AccessKeyOut, AdminSystemRowOut, AdminUserCreate, AdminUserOut, AdminUserUpdate, AdminWhatsAppConfigOut, CompanyContractStatusOut, ManagerProfileUpdate, WhatsAppSenderUpdate
from ..security import get_current_user, get_current_company, hash_password, require_manager_password, require_master_user
from ..whatsapp_client import get_bridge_qr, get_bridge_status, reset_bridge_session


router = APIRouter()


def _slugify_company_name(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value.strip())
    slug = "-".join(part for part in cleaned.split("-") if part)
    return slug or f"empresa-{uuid.uuid4().hex[:8]}"


def _generate_contract_code() -> str:
    return f"CTR-{datetime.utcnow():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def _create_company(name: str) -> Company:
    return Company(
        name=name.strip(),
        slug=f"{_slugify_company_name(name)}-{uuid.uuid4().hex[:6]}",
        contract_code=_generate_contract_code(),
    )


def _sync_user_company(db: Session, user: User, company_name: str | None) -> None:
    if company_name is None:
        return
    normalized_name = company_name.strip()
    if not normalized_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome da empresa obrigatorio")
    if user.company is None:
        company = _create_company(normalized_name)
        db.add(company)
        db.flush()
        user.company_id = company.id
    else:
        user.company.name = normalized_name
        db.add(user.company)


def _access_key_out(key: AccessKey) -> AccessKeyOut:
    used_user = key.__dict__.get("linked_user")
    company_name = None
    user_name = None
    if used_user is not None:
        user_name = used_user.full_name or used_user.email
        company_name = used_user.company.name if used_user.company else None
    return AccessKeyOut(
        id=key.id,
        keyToken=key.key_token,
        label=key.label,
        accessKeyStatus=key.status,
        contractStatus=used_user.company.contract_status if used_user and used_user.company else None,
        userStatus=used_user.user_status if used_user else None,
        usedByUserId=used_user.id if used_user is not None else key.used_by_user_id,
        usedByUserName=user_name,
        companyName=company_name,
        contractCode=used_user.company.contract_code if used_user and used_user.company else None,
        usedAt=key.used_at,
        createdAt=key.created_at,
    )


def _resolve_linked_user(db: Session, key: AccessKey) -> User | None:
    if key.used_by_user_id is not None:
        user = db.get(User, key.used_by_user_id)
        if user is not None:
            return user
    if key.id is None:
        return None
    return db.scalar(select(User).where(User.access_key_id == key.id))


def _build_admin_system_rows(db: Session) -> list[AdminSystemRowOut]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    keys = db.scalars(select(AccessKey).order_by(AccessKey.created_at.desc())).all()

    keys_by_id = {key.id: key for key in keys if key.id is not None}
    key_by_used_user_id = {key.used_by_user_id: key for key in keys if key.used_by_user_id is not None}
    orphan_keys: list[AccessKey] = []
    rows: list[AdminSystemRowOut] = []
    consumed_key_ids: set[int] = set()

    for user in users:
        linked_key = None
        if user.access_key_id is not None:
            linked_key = keys_by_id.get(user.access_key_id)
        if linked_key is None:
            linked_key = key_by_used_user_id.get(user.id)
        if linked_key is not None and linked_key.id is not None:
            consumed_key_ids.add(linked_key.id)

        rows.append(
            AdminSystemRowOut(
                rowType="user",
                rowId=f"user-{user.id}",
                userId=user.id,
                email=user.email,
                fullName=user.full_name,
                companyId=user.company_id,
                companyName=user.company.name if user.company else None,
                contractCode=user.company.contract_code if user.company else None,
                contractStatus=user.company.contract_status if user.company else None,
                userStatus=user.user_status,
                phone=user.phone,
                isMaster=user.is_master,
                accessKeyId=linked_key.id if linked_key else None,
                accessKeyStatus=linked_key.status if linked_key else None,
                keyToken=linked_key.key_token if linked_key else None,
                keyLabel=linked_key.label if linked_key else None,
                keyUsedAt=linked_key.used_at if linked_key else None,
                createdAt=user.created_at,
            )
        )

    for key in keys:
        if key.id is not None and key.id in consumed_key_ids:
            continue
        linked_user = _resolve_linked_user(db, key)
        if linked_user is not None:
            continue
        orphan_keys.append(key)

    for key in orphan_keys:
        rows.append(
            AdminSystemRowOut(
                rowType="access-key",
                rowId=f"access-key-{key.id}",
                accessKeyId=key.id,
                accessKeyStatus=key.status,
                keyToken=key.key_token,
                keyLabel=key.label,
                keyUsedAt=key.used_at,
                createdAt=key.created_at,
            )
        )

    return rows


def _admin_user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        fullName=user.full_name,
        companyId=user.company_id,
        companyName=user.company.name if user.company else None,
        contractCode=user.company.contract_code if user.company else None,
        contractStatus=user.company.contract_status if user.company else None,
        userStatus=user.user_status,
        phone=user.phone,
        isMaster=user.is_master,
        createdAt=user.created_at,
    )


def _normalize_sender_phone(phone: str | None) -> str | None:
    if phone is None:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if not digits:
        return None
    if digits.startswith("55") and len(digits) in {12, 13}:
        return digits
    if len(digits) in {10, 11}:
        return f"55{digits}"
    return digits


def _build_whatsapp_config(company) -> AdminWhatsAppConfigOut:
    status_payload = get_bridge_status()
    qr_payload = get_bridge_qr()
    return AdminWhatsAppConfigOut(
        senderPhone=company.whatsapp_sender_phone,
        connected=bool(status_payload.get("connected", False)),
        registered=bool(status_payload.get("registered", False)),
        qr=qr_payload.get("qr"),
        detail=status_payload.get("detail") or qr_payload.get("detail"),
        linkMode=status_payload.get("linkMode"),
    )


@router.put("/manager-profile")
def update_manager_profile(
    payload: ManagerProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if payload.fullName is not None:
        user.full_name = payload.fullName
    if payload.phone is not None:
        user.phone = payload.phone
    db.add(user)
    db.commit()
    return {"status": "ok"}


@router.get("/whatsapp/config", response_model=AdminWhatsAppConfigOut)
def get_whatsapp_config(
    company=Depends(get_current_company),
) -> AdminWhatsAppConfigOut:
    return _build_whatsapp_config(company)


@router.put("/whatsapp/config", response_model=AdminWhatsAppConfigOut)
def update_whatsapp_config(
    payload: WhatsAppSenderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager_password),
    company=Depends(get_current_company),
) -> AdminWhatsAppConfigOut:
    normalized_phone = _normalize_sender_phone(payload.phone)
    if normalized_phone is None or len(normalized_phone) not in {10, 11, 12, 13}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Numero de WhatsApp invalido")

    company.whatsapp_sender_phone = normalized_phone
    db.add(company)
    db.commit()
    return _build_whatsapp_config(company)


@router.post("/whatsapp/relink", response_model=AdminWhatsAppConfigOut)
def relink_whatsapp(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager_password),
    company=Depends(get_current_company),
) -> AdminWhatsAppConfigOut:
    result = reset_bridge_session()
    if not bool(result.get("ok", False)):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=result.get("detail") or "Falha ao reiniciar bridge")
    return _build_whatsapp_config(company)


@router.get("/system/users", response_model=list[AdminUserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> list[AdminUserOut]:
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [_admin_user_out(user) for user in users]


@router.post("/system/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminUserCreate, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> AdminUserOut:
    email = payload.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario ja existe")
    user = User(
        email=email,
        full_name=payload.fullName,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        user_status=UserStatus.ACTIVE.value,
        is_master=payload.isMaster,
    )
    _sync_user_company(db, user, payload.companyName)
    db.add(user)
    db.commit()
    db.refresh(user)
    return _admin_user_out(user)


@router.put("/system/users/{user_id}", response_model=AdminUserOut)
def update_user(user_id: int, payload: AdminUserUpdate, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado")
    if payload.fullName is not None:
        user.full_name = payload.fullName
    _sync_user_company(db, user, payload.companyName)
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if payload.isMaster is not None:
        if payload.isMaster and user.user_status != UserStatus.ACTIVE.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ative o usuario antes de conceder acesso master")
        user.is_master = payload.isMaster
    db.add(user)
    db.commit()
    db.refresh(user)
    return _admin_user_out(user)


@router.delete("/system/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado")
    db.delete(user)
    db.commit()
    return {"status": "deleted"}


@router.patch("/system/users/{user_id}/toggle-status", response_model=AdminUserOut)
def toggle_user_status(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado")
    if user.user_status != UserStatus.ACTIVE.value and user.company and user.company.contract_status != ContractStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ative o contrato antes de liberar o usuario")
    user.user_status = UserStatus.INACTIVE.value if user.user_status == UserStatus.ACTIVE.value else UserStatus.ACTIVE.value
    db.add(user)
    db.commit()
    db.refresh(user)
    return _admin_user_out(user)


@router.patch("/system/companies/{company_id}/toggle-contract-status", response_model=CompanyContractStatusOut)
def toggle_contract_status(company_id: int, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> CompanyContractStatusOut:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa nao encontrada")
    company.contract_status = ContractStatus.INACTIVE.value if company.contract_status == ContractStatus.ACTIVE.value else ContractStatus.ACTIVE.value
    db.add(company)
    db.commit()
    db.refresh(company)
    return CompanyContractStatusOut(companyId=company.id, contractStatus=company.contract_status)


@router.get("/system/access-keys", response_model=list[AccessKeyOut])
def list_access_keys(db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> list[AccessKeyOut]:
    keys = db.scalars(select(AccessKey).order_by(AccessKey.created_at.desc())).all()
    key_ids = [key.id for key in keys]
    used_user_ids = [key.used_by_user_id for key in keys if key.used_by_user_id is not None]
    candidate_users = db.scalars(
        select(User).where(
            (User.id.in_(used_user_ids) if used_user_ids else False) |
            (User.access_key_id.in_(key_ids) if key_ids else False)
        )
    ).all() if key_ids or used_user_ids else []
    users_by_id = {user.id: user for user in candidate_users}
    users_by_access_key_id = {user.access_key_id: user for user in candidate_users if user.access_key_id is not None}
    for key in keys:
        linked_user = users_by_id.get(key.used_by_user_id) if key.used_by_user_id is not None else None
        if linked_user is None:
            linked_user = users_by_access_key_id.get(key.id)
        key.__dict__["linked_user"] = linked_user
    return [_access_key_out(key) for key in keys]


@router.get("/system/overview", response_model=list[AdminSystemRowOut])
def list_admin_system_rows(db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> list[AdminSystemRowOut]:
    return _build_admin_system_rows(db)


@router.get("/system/access-keys/export")
def export_access_keys(db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> FileResponse:
    admin_rows = _build_admin_system_rows(db)
    rows = [
        {
            "Tipo": "Usuario" if item.rowType == "user" else "Chave avulsa",
            "Empresa": item.companyName,
            "Contrato": item.contractCode,
            "Status contrato": "Ativo" if item.contractStatus == ContractStatus.ACTIVE.value else "Inativo" if item.contractStatus == ContractStatus.INACTIVE.value else None,
            "Usuario": item.fullName or item.email,
            "Email": item.email,
            "Telefone": item.phone,
            "Status usuario": "Ativo" if item.userStatus == UserStatus.ACTIVE.value else "Inativo" if item.userStatus == UserStatus.INACTIVE.value else None,
            "Perfil": "Master" if item.isMaster else "Operacional" if item.userId is not None else None,
            "Rotulo chave": item.keyLabel,
            "Chave": item.keyToken,
            "Status chave": "Ativa" if item.accessKeyStatus == AccessKeyStatus.ACTIVE.value else "Inativa" if item.accessKeyStatus == AccessKeyStatus.INACTIVE.value else None,
            "Utilizada em": item.keyUsedAt.strftime("%d/%m/%Y %H:%M") if item.keyUsedAt else None,
            "Criada em": item.createdAt.strftime("%d/%m/%Y %H:%M"),
        }
        for item in admin_rows
    ]

    dataframe = pd.DataFrame(rows)
    target = Path(tempfile.gettempdir()) / f"washapp2_admin_sistema_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
    dataframe.to_excel(target, index=False)
    return FileResponse(path=target, filename=target.name)


@router.post("/system/access-keys", response_model=AccessKeyOut, status_code=status.HTTP_201_CREATED)
def create_access_key(payload: AccessKeyCreate, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> AccessKeyOut:
    key = AccessKey(key_token=payload.keyToken or str(uuid.uuid4()), label=payload.label, status=AccessKeyStatus.ACTIVE.value)
    db.add(key)
    db.commit()
    db.refresh(key)
    return _access_key_out(key)


@router.patch("/system/access-keys/{key_id}/toggle", response_model=AccessKeyOut)
def toggle_access_key(key_id: int, db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> AccessKeyOut:
    key = db.get(AccessKey, key_id)
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chave nao encontrada")
    linked_user = _resolve_linked_user(db, key)
    if key.status != AccessKeyStatus.ACTIVE.value and linked_user and linked_user.company and linked_user.company.contract_status != ContractStatus.ACTIVE.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ative o contrato antes de reativar a chave")
    key.status = AccessKeyStatus.INACTIVE.value if key.status == AccessKeyStatus.ACTIVE.value else AccessKeyStatus.ACTIVE.value
    db.add(key)
    db.commit()
    db.refresh(key)
    key.__dict__["linked_user"] = linked_user
    return _access_key_out(key)


@router.put("/settings")
def update_settings(payload: dict[str, str], db: Session = Depends(get_db), _: User = Depends(require_master_user)) -> dict:
    db.commit()
    return {"status": "ok"}
