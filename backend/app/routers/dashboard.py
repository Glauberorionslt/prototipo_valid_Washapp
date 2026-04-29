from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Customer, Order, Product, User
from ..schemas import CurrentUserOut, CustomerOut, DashboardOut, DashboardStatsOut, OrderItemOut, OrderOut, ProductOut
from ..security import get_current_user


router = APIRouter()


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _user_out(user: User) -> CurrentUserOut:
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
        accessKeyStatus=user.access_key.status if user.access_key else None,
        plan=user.company.plan_name if user.company else "Pago",
        email=user.email,
        phone=user.phone,
        companyId=user.company_id,
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


def _product_out(product: Product) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=product.name,
        price=float(product.price),
        isActive=product.is_active,
        createdAt=product.created_at,
    )


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


@router.get("", response_model=DashboardOut)
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardOut:
    if user.company_id is None:
        customers = []
        products = []
        orders = []
    else:
        customers = db.scalars(select(Customer).where(
            Customer.company_id == user.company_id).order_by(Customer.name)).all()
        products = db.scalars(select(Product).where(
            Product.company_id == user.company_id, Product.is_active.is_(True)).order_by(Product.name)).all()
        orders = db.scalars(
            select(Order).where(Order.company_id == user.company_id).options(
                selectinload(Order.items)).order_by(Order.created_at.desc())
        ).all()

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)

    today_orders = [order for order in orders if _as_utc(
        order.created_at) >= today_start]
    week_orders = [order for order in orders if _as_utc(
        order.created_at) >= week_start]
    finalized_today = [
        o for o in today_orders if o.status in {"pronto", "entregue"}]
    finalized_week = [
        o for o in week_orders if o.status in {"pronto", "entregue"}]

    stats = DashboardStatsOut(
        totalToday=len(today_orders),
        waiting=sum(1 for o in today_orders if o.status == "aguardando"),
        washing=sum(1 for o in today_orders if o.status == "em_lavagem"),
        ready=sum(1 for o in today_orders if o.status == "pronto"),
        delivered=sum(1 for o in today_orders if o.status == "entregue"),
        revenueToday=round(sum(float(o.total) for o in finalized_today), 2),
        revenueWeek=round(sum(float(o.total) for o in finalized_week), 2),
        ticketAvg=round(
            (sum(float(o.total) for o in finalized_week) /
             len(finalized_week)) if finalized_week else 0,
            2,
        ),
    )

    return DashboardOut(
        currentUser=_user_out(user),
        stats=stats,
        customers=[_customer_out(customer) for customer in customers],
        products=[_product_out(product) for product in products],
        orders=[_order_out(order) for order in orders],
    )
