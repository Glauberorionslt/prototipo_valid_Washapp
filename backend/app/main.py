from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import create_schema
from .routers import admin, auth, customers, dashboard, finance, operational_costs, orders, products, team, whatsapp


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_schema()
    yield


app = FastAPI(title="Washapp V2 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins or [
        "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(products.router, prefix="/products", tags=["products"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(finance.router, prefix="/finance", tags=["finance"])
app.include_router(team.router, prefix="/team", tags=["team"])
app.include_router(operational_costs.router,
                   prefix="/operational-costs", tags=["operational-costs"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(whatsapp.router, prefix="/whatsapp", tags=["whatsapp"])


@app.get("/")
def root() -> dict:
    return {"message": "Washapp V2 API"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
