from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Customer, Order, OrderItem, WhatsAppLog
from ..schemas import OrderCreate, OrderItemOut, OrderOut, OrderUpdate
from ..security import get_current_user, require_manager_password
from ..whatsapp_client import send_text_message


router = APIRouter()


def _normalize_phone(phone: str | None) -> str | None:
    if phone is None:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    return digits or None


def _normalize_plate(plate: str | None) -> str | None:
    if plate is None:
        return None
    cleaned = "".join(ch for ch in plate.upper() if ch.isalnum())
    return cleaned or None


def _order_out(order: Order) -> OrderOut:
    return OrderOut(
        id=order.id,
        customerId=order.customer_id,
        customerName=order.customer_name,
        phone=order.phone,
        vehicle=order.vehicle,
        plate=order.plate,
        color=order.color,
        washType=order.wash_type,
        basePrice=float(order.base_price),
        total=float(order.total),
        status=order.status,
        notes=order.notes,
        createdAt=order.created_at,
        items=[
            OrderItemOut(
                id=item.id,
                productId=item.product_id,
                name=item.name,
                price=float(item.price),
                quantity=item.quantity,
            )
            for item in order.items
        ],
    )


def _apply_customer_snapshot(order: Order, customer: Customer | None, payload: OrderCreate | OrderUpdate) -> None:
    if customer and isinstance(payload, OrderCreate):
        order.customer_id = customer.id
        order.customer_name = payload.customerName or customer.name
        order.phone = _normalize_phone(payload.phone) or customer.phone
        order.vehicle = payload.vehicle or customer.vehicle
        order.plate = _normalize_plate(payload.plate or customer.plate)
        order.color = payload.color or customer.color
        return
    for field in ["customerName", "phone", "vehicle", "plate", "color"]:
        value = getattr(payload, field, None)
        if value is not None:
            if field == "phone":
                value = _normalize_phone(value)
            elif field == "plate":
                value = _normalize_plate(value)
            setattr(order, {
                "customerName": "customer_name",
                "phone": "phone",
                "vehicle": "vehicle",
                "plate": "plate",
                "color": "color",
            }[field], value)


def _enforce_status_rules(order: Order, new_status: str | None) -> None:
    if new_status is None:
        return
    if order.status == "entregue" and new_status != "entregue":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordem entregue nao pode ser alterada")
    if order.status == "pronto" and new_status not in {"pronto", "entregue"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordem pronta so pode seguir para entregue")


def _build_ready_message(order: Order) -> str:
    return (
        f"Ola, {order.customer_name}!\n"
        f"Sua ordem #{order.id} esta pronta para retirada.\n"
        f"Veiculo: {order.vehicle or '-'} | Placa: {order.plate or '-'}\n"
        f"Valor: R$ {float(order.total):.2f}"
    )


@router.get("", response_model=list[OrderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
) -> list[OrderOut]:
    if user.company_id is None:
        return []
    stmt = select(Order).options(selectinload(Order.items)).order_by(Order.created_at.desc())
    stmt = stmt.where(Order.company_id == user.company_id)
    if status_filter:
        stmt = stmt.where(Order.status == status_filter)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Order.customer_name.ilike(like),
                Order.plate.ilike(like),
                Order.vehicle.ilike(like),
            )
        )
    orders = db.scalars(stmt).all()
    return [_order_out(order) for order in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> OrderOut:
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")
    return _order_out(order)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> OrderOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario sem empresa vinculada")
    customer = db.scalar(select(Customer).where(Customer.id == payload.customerId, Customer.company_id == user.company_id)) if payload.customerId else None
    customer_name = payload.customerName or (customer.name if customer else "Avulso")
    order = Order(
        company_id=user.company_id,
        customer_id=customer.id if customer and not customer.is_default else None,
        customer_name=customer_name,
        phone=_normalize_phone(payload.phone) or (customer.phone if customer else None),
        vehicle=payload.vehicle or (customer.vehicle if customer else None),
        plate=_normalize_plate(payload.plate or (customer.plate if customer else None)),
        color=payload.color or (customer.color if customer else None),
        wash_type=payload.washType,
        base_price=payload.basePrice,
        total=payload.total,
        status="aguardando",
        notes=payload.notes,
    )
    db.add(order)
    db.flush()

    for item in payload.items:
        db.add(
            OrderItem(
                order_id=order.id,
                product_id=item.productId,
                name=item.name,
                price=item.price,
                quantity=item.quantity,
            )
        )
    db.commit()
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order.id))
    if payload.sendWhatsapp and order and order.phone:
        message = (
            f"Ola, {order.customer_name}!\n"
            f"Sua ordem #{order.id} foi registrada com sucesso.\n"
            f"Valor previsto: R$ {float(order.total):.2f}"
        )
        result = send_text_message(order.phone, message)
        db.add(
            WhatsAppLog(
                    company_id=user.company_id,
                order_id=order.id,
                phone=order.phone,
                message=message,
                status="sent" if result.ok else "failed",
                provider_message_id=result.provider_message_id,
            )
        )
        db.commit()
    return _order_out(order)


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> OrderOut:
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")

    new_status = payload.status
    _enforce_status_rules(order, new_status)

    if order.status == "entregue":
        mutable_fields = payload.model_dump(exclude_unset=True)
        disallowed = set(mutable_fields) - {"status"}
        if disallowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordem entregue nao pode ser editada")

    mapping = {
        "customerName": "customer_name",
        "phone": "phone",
        "vehicle": "vehicle",
        "plate": "plate",
        "color": "color",
        "washType": "wash_type",
        "basePrice": "base_price",
        "total": "total",
        "notes": "notes",
        "status": "status",
    }
    for field, value in payload.model_dump(exclude_unset=True, exclude={"items"}).items():
        if field == "phone":
            value = _normalize_phone(value)
        elif field == "plate":
            value = _normalize_plate(value)
        setattr(order, mapping[field], value)

    if payload.items is not None and order.status not in {"pronto", "entregue"}:
        order.items.clear()
        db.flush()
        for item in payload.items:
            order.items.append(
                OrderItem(
                    product_id=item.productId,
                    name=item.name,
                    price=item.price,
                    quantity=item.quantity,
                )
            )

    if new_status == "pronto" and order.phone and order.notified_ready_at is None:
        message = _build_ready_message(order)
        result = send_text_message(order.phone, message)
        db.add(
            WhatsAppLog(
                company_id=user.company_id,
                order_id=order.id,
                phone=order.phone,
                message=message,
                status="sent" if result.ok else "failed",
                provider_message_id=result.provider_message_id,
            )
        )
        if result.ok:
            order.notified_ready_at = datetime.utcnow()

    db.add(order)
    db.commit()
    db.refresh(order)
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(Order.id == order_id))
    return _order_out(order)


@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: object = Depends(require_manager_password),
) -> dict:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")
    db.delete(order)
    db.commit()
    return {"status": "deleted"}


@router.post("/{order_id}/notify-ready")
def notify_ready(order_id: int, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> dict:
    order = db.scalar(select(Order).where(Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")
    if not order.phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ordem sem telefone")
    result = send_text_message(order.phone, _build_ready_message(order))
    db.add(
        WhatsAppLog(
            company_id=user.company_id,
            order_id=order.id,
            phone=order.phone,
            message=_build_ready_message(order),
            status="sent" if result.ok else "failed",
            provider_message_id=result.provider_message_id,
        )
    )
    if result.ok:
        order.notified_ready_at = datetime.utcnow()
    db.add(order)
    db.commit()
    return {"status": "ok", "detail": result.detail}
