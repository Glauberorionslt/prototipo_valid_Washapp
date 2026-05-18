from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Customer, Order, OrderItem
from ..plate_reader import PlateReaderNotFoundError, PlateReaderUnavailableError, scan_plate_image
from ..plate_reader_quota import PlateReaderQuotaExceededError, PlateReaderQuotaUnavailableError, ensure_plate_reader_quota_available, register_plate_reader_usage
from ..schemas import CustomerOut, OrderCreate, OrderItemOut, OrderOut, OrderUpdate, PlateReaderScanOut, ReservedOrderIdOut
from ..security import get_current_user, require_manager_password
from ..time_utils import now_local


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
        deliveredAt=order.delivered_at,
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


def _find_customer_by_plate(db: Session, company_id: int, plate: str) -> Customer | None:
    customers = db.scalars(select(Customer).where(Customer.company_id == company_id).order_by(Customer.created_at.desc())).all()
    for customer in customers:
        if _normalize_plate(customer.plate) == plate:
            return customer
    return None


def _reserve_next_order_id(db: Session) -> int:
    bind = db.get_bind()
    dialect_name = bind.dialect.name if bind is not None else ""
    if dialect_name == "postgresql":
        next_id = db.execute(text("SELECT nextval(pg_get_serial_sequence('orders', 'id'))")).scalar_one()
        return int(next_id)
    max_id = db.scalar(select(func.max(Order.id))) or 0
    return int(max_id) + 1


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Ordem entregue nao pode ser alterada")
    if order.status == "pronto" and new_status not in {"pronto", "entregue"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Ordem pronta so pode seguir para entregue")


@router.get("", response_model=list[OrderOut])
def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
) -> list[OrderOut]:
    if user.company_id is None:
        return []
    stmt = select(Order).options(selectinload(Order.items)
                                 ).order_by(Order.created_at.desc())
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


@router.get("/reserve-next-id", response_model=ReservedOrderIdOut)
def reserve_next_order_id(db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> ReservedOrderIdOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario sem empresa vinculada")
    return ReservedOrderIdOut(reservedOrderId=_reserve_next_order_id(db))


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> OrderOut:
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(
        Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")
    return _order_out(order)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: OrderCreate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> OrderOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Usuario sem empresa vinculada")
    customer = db.scalar(select(Customer).where(Customer.id == payload.customerId,
                         Customer.company_id == user.company_id)) if payload.customerId else None
    customer_name = payload.customerName or (
        customer.name if customer else "Avulso")
    order = Order(
        company_id=user.company_id,
        customer_id=customer.id if customer and not customer.is_default else None,
        customer_name=customer_name,
        phone=_normalize_phone(payload.phone) or (
            customer.phone if customer else None),
        vehicle=payload.vehicle or (customer.vehicle if customer else None),
        plate=_normalize_plate(payload.plate or (
            customer.plate if customer else None)),
        color=payload.color or (customer.color if customer else None),
        wash_type=payload.washType,
        base_price=payload.basePrice,
        total=payload.total,
        status="aguardando",
        notes=payload.notes,
    )
    if payload.reservedOrderId is not None:
        order.id = payload.reservedOrderId
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
    order = db.scalar(select(Order).options(
        selectinload(Order.items)).where(Order.id == order.id))
    return _order_out(order)


@router.post("/plate-reader/scan", response_model=PlateReaderScanOut)
def scan_plate_and_lookup_customer(
    upload: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
) -> PlateReaderScanOut:
    if user.company_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario sem empresa vinculada")

    try:
        ensure_plate_reader_quota_available(db, user)
    except PlateReaderQuotaUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except PlateReaderQuotaExceededError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    file_bytes = upload.file.read()
    try:
        result = scan_plate_image(file_bytes)
    except PlateReaderUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except PlateReaderNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    quota_snapshot = register_plate_reader_usage(db, user)

    plate = _normalize_plate(result.plate)
    if not plate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhuma placa valida foi reconhecida na imagem")

    customer = _find_customer_by_plate(db, user.company_id, plate)
    reserved_order_id = None if customer else _reserve_next_order_id(db)
    return PlateReaderScanOut(
        plate=plate,
        confidence=result.confidence,
        customer=_customer_out(customer) if customer else None,
        reservedOrderId=reserved_order_id,
        rawText=result.raw_text,
        plateReaderQuotaLimit=quota_snapshot.monthly_limit if quota_snapshot else None,
        plateReaderQuotaUsed=quota_snapshot.used_count if quota_snapshot else None,
        plateReaderQuotaRemaining=quota_snapshot.remaining_count if quota_snapshot else None,
        plateReaderLowQuotaWarning=quota_snapshot.low_remaining_warning if quota_snapshot else False,
    )


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> OrderOut:
    order = db.scalar(select(Order).options(selectinload(Order.items)).where(
        Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")

    new_status = payload.status
    _enforce_status_rules(order, new_status)

    if order.status == "entregue":
        mutable_fields = payload.model_dump(exclude_unset=True)
        disallowed = set(mutable_fields) - {"status"}
        if disallowed:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Ordem entregue nao pode ser editada")

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

    if new_status == "entregue" and order.delivered_at is None:
        order.delivered_at = now_local()

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

    db.add(order)
    db.commit()
    db.refresh(order)
    order = db.scalar(select(Order).options(
        selectinload(Order.items)).where(Order.id == order_id))
    return _order_out(order)


@router.delete("/{order_id}")
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    user: object = Depends(require_manager_password),
) -> dict:
    order = db.scalar(select(Order).where(
        Order.id == order_id, Order.company_id == user.company_id))
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ordem nao encontrada")
    db.delete(order)
    db.commit()
    return {"status": "deleted"}


@router.post("/{order_id}/notify-ready")
def notify_ready(order_id: int, db: Session = Depends(get_db), user: object = Depends(get_current_user)) -> dict:
    _ = (order_id, db, user)
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Funcionalidade de aviso foi desativada",
    )
