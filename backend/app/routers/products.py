from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductOut, ProductUpdate
from ..security import get_current_user, require_manager_password


router = APIRouter()


def _product_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        price=float(product.price),
        isActive=product.is_active,
        createdAt=product.created_at,
    )


@router.get("", response_model=list[ProductOut])
def list_products(
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
) -> list[ProductOut]:
    if user.company_id is None:
        return []
    stmt = select(Product).order_by(Product.name)
    stmt = stmt.where(Product.company_id == user.company_id)
    if q:
        stmt = stmt.where(Product.name.ilike(f"%{q.strip()}%"))
    products = db.scalars(stmt).all()
    return [_product_out(product) for product in products]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> ProductOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario sem empresa vinculada")
    product = Product(company_id=user.company_id, name=payload.name.strip(), price=payload.price)
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_out(product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    user: object = Depends(require_manager_password),
) -> ProductOut:
    product = db.scalar(select(Product).where(Product.id == product_id, Product.company_id == user.company_id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto nao encontrado")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "isActive":
            product.is_active = bool(value)
        else:
            setattr(product, field, value)
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_out(product)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    user: object = Depends(require_manager_password),
) -> dict:
    product = db.scalar(select(Product).where(Product.id == product_id, Product.company_id == user.company_id))
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Produto nao encontrado")
    db.delete(product)
    db.commit()
    return {"status": "deleted"}
