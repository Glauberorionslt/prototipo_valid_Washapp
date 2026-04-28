from __future__ import annotations

from datetime import datetime, date

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    needs_key: bool
    needs_manager_password: bool
    is_master: bool
    email: EmailStr
    name: str | None = None


class ActivateKeyRequest(BaseModel):
    key_token: str


class PasswordRequest(BaseModel):
    password: str = Field(min_length=4, max_length=100)


class BootstrapMasterRequest(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str = Field(min_length=6, max_length=100)


class CurrentUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    role: str
    isMaster: bool
    managerPasswordConfigured: bool
    shop: str
    contractCode: str | None = None
    contractStatus: str | None = None
    userStatus: str | None = None
    accessKeyStatus: str | None = None
    plan: str
    email: EmailStr
    phone: str | None = None
    companyId: int | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr
    accessKeyToken: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6, max_length=100)


class AdminOperationalAccessRequest(BaseModel):
    managerPassword: str | None = Field(default=None, min_length=1, max_length=100)
    accessKeyToken: str | None = Field(default=None, min_length=1, max_length=255)


class DashboardStatsOut(BaseModel):
    totalToday: int
    waiting: int
    washing: int
    ready: int
    delivered: int
    revenueToday: float
    revenueWeek: float
    ticketAvg: float


class CustomerBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    vehicle: str | None = Field(default=None, max_length=120)
    plate: str | None = Field(default=None, max_length=16)
    color: str | None = Field(default=None, max_length=50)


class CustomerCreate(CustomerBase):
    isDefault: bool = False


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    vehicle: str | None = None
    plate: str | None = None
    color: str | None = None


class CustomerOut(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isDefault: bool
    createdAt: datetime


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    price: float = Field(gt=0)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    price: float | None = Field(default=None, gt=0)
    isActive: bool | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isActive: bool
    createdAt: datetime


class OrderItemIn(BaseModel):
    productId: int | None = None
    name: str
    price: float = Field(ge=0)
    quantity: int = Field(ge=1)


class OrderItemOut(OrderItemIn):
    id: int


class OrderCreate(BaseModel):
    customerId: int | None = None
    customerName: str | None = None
    phone: str | None = None
    vehicle: str | None = None
    plate: str | None = None
    color: str | None = None
    washType: str
    basePrice: float = Field(ge=0)
    total: float = Field(ge=0)
    items: list[OrderItemIn] = Field(default_factory=list)
    notes: str | None = None
    sendWhatsapp: bool = False


class OrderUpdate(BaseModel):
    customerName: str | None = None
    phone: str | None = None
    vehicle: str | None = None
    plate: str | None = None
    color: str | None = None
    washType: str | None = None
    basePrice: float | None = Field(default=None, ge=0)
    total: float | None = Field(default=None, ge=0)
    status: str | None = None
    notes: str | None = None
    items: list[OrderItemIn] | None = None


class OrderOut(BaseModel):
    id: int
    customerId: int | None
    customerName: str
    phone: str | None
    vehicle: str | None
    plate: str | None
    color: str | None
    washType: str
    basePrice: float
    total: float
    status: str
    notes: str | None
    createdAt: datetime
    items: list[OrderItemOut]


class DashboardOut(BaseModel):
    currentUser: CurrentUserOut
    stats: DashboardStatsOut
    customers: list[CustomerOut]
    products: list[ProductOut]
    orders: list[OrderOut]


class FinanceRowOut(BaseModel):
    id: int
    customerName: str
    phone: str | None
    vehicle: str | None
    plate: str | None
    status: str
    total: float
    createdAt: datetime


class FinanceSummaryOut(BaseModel):
    totalAmount: float
    finalizedCount: int
    teamCostTotal: float = 0
    operationalCostTotal: float = 0
    netOperationalTotal: float = 0


class FinanceReportOut(BaseModel):
    summary: FinanceSummaryOut
    rows: list[FinanceRowOut]


class ManagerProfileUpdate(BaseModel):
    fullName: str | None = None
    phone: str | None = None


class AccessKeyCreate(BaseModel):
    label: str | None = None
    keyToken: str | None = None


class AccessKeyOut(BaseModel):
    id: int
    keyToken: str
    label: str | None
    accessKeyStatus: str
    contractStatus: str | None = None
    userStatus: str | None = None
    usedByUserId: int | None
    usedByUserName: str | None = None
    companyName: str | None = None
    contractCode: str | None = None
    usedAt: datetime | None
    createdAt: datetime


class AdminUserCreate(BaseModel):
    email: EmailStr
    fullName: str | None = None
    companyName: str = Field(min_length=1, max_length=255)
    phone: str | None = None
    password: str = Field(min_length=6, max_length=100)
    isMaster: bool = False


class AdminUserUpdate(BaseModel):
    fullName: str | None = None
    companyName: str | None = None
    phone: str | None = None
    password: str | None = None
    isMaster: bool | None = None


class AdminUserOut(BaseModel):
    id: int
    email: EmailStr
    fullName: str | None
    companyId: int | None = None
    companyName: str | None = None
    contractCode: str | None = None
    contractStatus: str | None = None
    userStatus: str
    phone: str | None
    isMaster: bool
    createdAt: datetime


class CompanyContractStatusOut(BaseModel):
    companyId: int
    contractStatus: str


class AdminSystemRowOut(BaseModel):
    rowType: str
    rowId: str
    userId: int | None = None
    email: EmailStr | None = None
    fullName: str | None = None
    companyId: int | None = None
    companyName: str | None = None
    contractCode: str | None = None
    contractStatus: str | None = None
    userStatus: str | None = None
    phone: str | None = None
    isMaster: bool = False
    accessKeyId: int | None = None
    accessKeyStatus: str | None = None
    keyToken: str | None = None
    keyLabel: str | None = None
    keyUsedAt: datetime | None = None
    createdAt: datetime


class WhatsAppStatusOut(BaseModel):
    connected: bool = False
    registered: bool = False
    lastQr: str | None = None
    detail: str | None = None
    linkMode: str | None = None


class WhatsAppSenderUpdate(BaseModel):
    phone: str = Field(min_length=10, max_length=20)


class AdminWhatsAppConfigOut(BaseModel):
    senderPhone: str | None = None
    connected: bool = False
    registered: bool = False
    qr: str | None = None
    detail: str | None = None
    linkMode: str | None = None


class WhatsAppSendTextIn(BaseModel):
    phone: str
    text: str


class WhatsAppResponseOut(BaseModel):
    ok: bool
    detail: str
    providerMessageId: str | None = None


class FinanceSendWhatsappIn(BaseModel):
    phone: str
    start: date | None = None
    end: date | None = None
    status: str | None = None


class TeamMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class TeamMemberUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    isActive: bool | None = None


class TeamMemberOut(BaseModel):
    id: int
    name: str
    isActive: bool
    createdAt: datetime


class TeamCostBatchItemIn(BaseModel):
    memberId: int
    amount: float = Field(ge=0)
    tipAmount: float = Field(default=0, ge=0)


class TeamCostBatchIn(BaseModel):
    entryDate: date
    items: list[TeamCostBatchItemIn] = Field(default_factory=list)


class TeamCostEntryUpdate(BaseModel):
    amount: float = Field(ge=0)
    tipAmount: float = Field(default=0, ge=0)


class TeamCostEntryOut(BaseModel):
    id: int
    entryDate: date
    memberId: int
    memberName: str
    amount: float
    tipAmount: float
    totalAmount: float
    createdAt: datetime
    updatedAt: datetime


class OperationalCostTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class OperationalCostTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    isActive: bool | None = None


class OperationalCostTypeOut(BaseModel):
    id: int
    name: str
    isActive: bool
    createdAt: datetime


class OperationalCostBatchItemIn(BaseModel):
    costTypeId: int
    amount: float = Field(ge=0)


class OperationalCostBatchIn(BaseModel):
    entryDate: date
    items: list[OperationalCostBatchItemIn] = Field(default_factory=list)


class OperationalCostEntryUpdate(BaseModel):
    amount: float = Field(ge=0)


class OperationalCostEntryOut(BaseModel):
    id: int
    entryDate: date
    costTypeId: int
    costTypeName: str
    amount: float
    createdAt: datetime
    updatedAt: datetime
