from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import AccessKey, AccessKeyStatus, Company, ContractStatus, User, UserStatus


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expires_at = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Missing Authorization header")
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid Authorization header")
    return parts[1].strip()


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token = _extract_bearer_token(authorization)
    try:
        payload = jwt.decode(token, settings.jwt_secret_key,
                             algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = db.scalar(select(User).where(User.id == int(subject)))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.user_status != UserStatus.ACTIVE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")
    if not user.is_master and user.company_id is not None:
        company = db.scalar(select(Company).where(
            Company.id == user.company_id))
        if company is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Empresa nao encontrada")
        if company.contract_status != ContractStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Contrato inativo")
    if not user.is_master and user.access_key_id is not None:
        access_key = db.scalar(select(AccessKey).where(
            AccessKey.id == user.access_key_id))
        if access_key is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Chave vinculada nao encontrada")
        if access_key.status != AccessKeyStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Chave inativa")
    return user


def require_master_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_master:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Master access required")
    return user


def require_manager_password(
    x_manager_password: str | None = Header(default=None),
    user: User = Depends(get_current_user),
) -> User:
    if user.is_master:
        return user
    if not user.manager_password_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Manager password not configured")
    if not x_manager_password or not verify_password(x_manager_password, user.manager_password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Invalid manager password")
    return user


def get_current_company(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Company:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Usuario sem empresa vinculada")
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    if company is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empresa nao encontrada")
    return company
