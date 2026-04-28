from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Customer
from ..schemas import CustomerCreate, CustomerOut, CustomerUpdate
from ..security import get_current_user


router = APIRouter()


def _normalize_phone(phone: str | None) -> str | None:
    if phone is None:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits or None


def _customer_out(customer: Customer) -> CustomerOut:
    return CustomerOut(
        id=customer.id,
        name=customer.name,
        phone=customer.phone,
        vehicle=customer.vehicle,
        plate=customer.plate,
        color=customer.color,
        isDefault=customer.is_default,
        createdAt=customer.created_at,
    )


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
) -> list[CustomerOut]:
    company_id = user.company_id
    if company_id is None:
        return []
    stmt = select(Customer).order_by(Customer.name)
    stmt = stmt.where(Customer.company_id == company_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(like), Customer.plate.ilike(like)))
    customers = db.scalars(stmt).all()
    return [_customer_out(customer) for customer in customers]


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> CustomerOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario sem empresa vinculada")
    customer = Customer(
        company_id=user.company_id,
        name=payload.name.strip(),
        phone=_normalize_phone(payload.phone),
        vehicle=payload.vehicle,
        plate=payload.plate.upper() if payload.plate else None,
        color=payload.color,
        is_default=payload.isDefault,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _customer_out(customer)


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> CustomerOut:
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.company_id == user.company_id))
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente nao encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "phone":
            setattr(customer, field, _normalize_phone(value))
        elif field == "plate" and value is not None:
            setattr(customer, field, value.upper())
        else:
            setattr(customer, field, value)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _customer_out(customer)


@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> dict:
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.company_id == user.company_id))
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente nao encontrado")
    db.delete(customer)
    db.commit()
    return {"status": "deleted"}
