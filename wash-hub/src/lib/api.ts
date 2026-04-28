import { clearAccessToken, getAccessToken } from "@/lib/auth";

const DEFAULT_API_PORT = import.meta.env.VITE_API_PORT ?? "8011";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();

  if (typeof window === "undefined") {
    return configured || `http://127.0.0.1:${DEFAULT_API_PORT}`;
  }

  const { protocol, hostname } = window.location;

  if (configured) {
    try {
      const configuredUrl = new URL(configured);
      if (isLoopbackHost(configuredUrl.hostname) && !isLoopbackHost(hostname)) {
        return `${configuredUrl.protocol}//${hostname}:${configuredUrl.port || DEFAULT_API_PORT}`;
      }
      return configured;
    } catch {
      return configured;
    }
  }

  return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
}

const API_BASE_URL = resolveApiBaseUrl();

type RequestOptions = RequestInit & {
  auth?: boolean;
  managerPassword?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type CurrentUser = {
  id: number;
  name: string;
  role: string;
  isMaster: boolean;
  managerPasswordConfigured: boolean;
  shop: string;
  contractCode?: string | null;
  contractStatus?: string | null;
  userStatus?: string | null;
  accessKeyStatus?: string | null;
  plan: string;
  email: string;
  phone?: string | null;
  companyId?: number | null;
};

export type AdminUser = {
  id: number;
  email: string;
  fullName: string | null;
  companyId: number | null;
  companyName: string | null;
  contractCode: string | null;
  contractStatus: string | null;
  userStatus: string;
  phone: string | null;
  isMaster: boolean;
  createdAt: string;
};

export type AccessKey = {
  id: number;
  keyToken: string;
  label: string | null;
  accessKeyStatus: string;
  contractStatus: string | null;
  userStatus: string | null;
  usedByUserId: number | null;
  usedByUserName: string | null;
  companyName: string | null;
  contractCode: string | null;
  usedAt: string | null;
  createdAt: string;
};

export type CompanyContractStatusPayload = {
  companyId: number;
  contractStatus: string;
};

export type AdminSystemRow = {
  rowType: string;
  rowId: string;
  userId: number | null;
  email: string | null;
  fullName: string | null;
  companyId: number | null;
  companyName: string | null;
  contractCode: string | null;
  contractStatus: string | null;
  userStatus: string | null;
  phone: string | null;
  isMaster: boolean;
  accessKeyId: number | null;
  accessKeyStatus: string | null;
  keyToken: string | null;
  keyLabel: string | null;
  keyUsedAt: string | null;
  createdAt: string;
};

export type DashboardStats = {
  totalToday: number;
  waiting: number;
  washing: number;
  ready: number;
  delivered: number;
  revenueToday: number;
  revenueWeek: number;
  ticketAvg: number;
};

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  vehicle: string | null;
  plate: string | null;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
};

export type Product = {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
};

export type OrderItem = {
  id: number;
  productId: number | null;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  id: number;
  customerId: number | null;
  customerName: string;
  phone: string | null;
  vehicle: string | null;
  plate: string | null;
  color: string | null;
  washType: string;
  basePrice: number;
  total: number;
  status: "aguardando" | "em_lavagem" | "pronto" | "entregue";
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
};

export type DashboardPayload = {
  currentUser: CurrentUser;
  stats: DashboardStats;
  customers: Customer[];
  products: Product[];
  orders: Order[];
};

export type LoginPayload = {
  access_token: string;
  token_type: string;
  needs_key: boolean;
  needs_manager_password: boolean;
  is_master: boolean;
  email: string;
  name?: string | null;
};

export type FinanceReport = {
  summary: {
    totalAmount: number;
    finalizedCount: number;
    teamCostTotal: number;
    operationalCostTotal: number;
    netOperationalTotal: number;
  };
  rows: Array<{
    id: number;
    customerName: string;
    phone: string | null;
    vehicle: string | null;
    plate: string | null;
    status: string;
    total: number;
    createdAt: string;
  }>;
};

export type TeamMember = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type TeamCostEntry = {
  id: number;
  entryDate: string;
  memberId: number;
  memberName: string;
  amount: number;
  tipAmount: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type OperationalCostType = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
};

export type OperationalCostEntry = {
  id: number;
  entryDate: string;
  costTypeId: number;
  costTypeName: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminWhatsAppConfig = {
  senderPhone: string | null;
  connected: boolean;
  registered: boolean;
  qr: string | null;
  detail: string | null;
  linkMode: string | null;
};

async function readResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const formatted = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const message = "msg" in item ? String(item.msg) : null;
          const location = "loc" in item && Array.isArray(item.loc) ? item.loc.join(".") : null;
          if (message && location) {
            return `${location}: ${message}`;
          }
          if (message) {
            return message;
          }
          return JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean);

    return formatted.join(" | ") || "Erro de validacao na requisicao";
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return "Erro inesperado na requisicao";
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  if (options.managerPassword) {
    headers.set("x-manager-password", options.managerPassword);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await readResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearAccessToken();
    }
    const detail =
      typeof payload === "object" && payload && "detail" in payload
        ? formatApiDetail(payload.detail)
        : typeof payload === "string"
          ? payload
          : `HTTP ${response.status}`;
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<LoginPayload>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function register(payload: { email: string; full_name?: string; password: string }) {
  return apiRequest<{ status: string; userId: number }>("/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function recoverPassword(payload: { email: string; accessKeyToken: string; password: string }) {
  return apiRequest<{ status: string }>("/auth/reset-password", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function activateKey(keyToken: string) {
  return apiRequest<{ status: string }>("/auth/set-key", {
    method: "POST",
    body: JSON.stringify({ key_token: keyToken }),
  });
}

export function fetchCurrentUser() {
  return apiRequest<CurrentUser>("/auth/me");
}

export function fetchDashboard() {
  return apiRequest<DashboardPayload>("/dashboard");
}

export function listCustomers(query?: string) {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiRequest<Customer[]>(`/customers${suffix}`);
}

export function createCustomer(payload: {
  name: string;
  phone?: string;
  vehicle?: string;
  plate?: string;
  color?: string;
  isDefault?: boolean;
}) {
  return apiRequest<Customer>("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(
  customerId: number,
  payload: { name?: string; phone?: string; vehicle?: string; plate?: string; color?: string },
) {
  return apiRequest<Customer>(`/customers/${customerId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteCustomer(customerId: number) {
  return apiRequest<{ status: string }>(`/customers/${customerId}`, {
    method: "DELETE",
  });
}

export function listProducts(query?: string) {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiRequest<Product[]>(`/products${suffix}`);
}

export function createProduct(payload: { name: string; price: number }) {
  return apiRequest<Product>("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProduct(
  productId: number,
  payload: { name?: string; price?: number; isActive?: boolean },
  managerPassword: string,
) {
  return apiRequest<Product>(`/products/${productId}`, {
    method: "PUT",
    managerPassword,
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(productId: number, managerPassword: string) {
  return apiRequest<{ status: string }>(`/products/${productId}`, {
    method: "DELETE",
    managerPassword,
  });
}

export function listOrders(status?: string, query?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (query) params.set("q", query);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<Order[]>(`/orders${suffix}`);
}

export function getOrder(orderId: number) {
  return apiRequest<Order>(`/orders/${orderId}`);
}

export function createOrder(payload: {
  customerId?: number | null;
  customerName?: string | null;
  phone?: string | null;
  vehicle?: string | null;
  plate?: string | null;
  color?: string | null;
  washType: string;
  basePrice: number;
  total: number;
  items: Array<{ productId?: number | null; name: string; price: number; quantity: number }>;
  notes?: string | null;
  sendWhatsapp?: boolean;
}) {
  return apiRequest<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateOrder(
  orderId: number,
  payload: {
    customerName?: string;
    phone?: string;
    vehicle?: string;
    plate?: string;
    color?: string;
    washType?: string;
    basePrice?: number;
    total?: number;
    status?: string;
    notes?: string | null;
  },
) {
  return apiRequest<Order>(`/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteOrder(orderId: number, managerPassword: string) {
  return apiRequest<{ status: string }>(`/orders/${orderId}`, {
    method: "DELETE",
    managerPassword,
  });
}

export function notifyReady(orderId: number) {
  return apiRequest<{ status: string; detail: string }>(`/orders/${orderId}/notify-ready`, {
    method: "POST",
  });
}

export function fetchFinanceReport(filters: { start?: string; end?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<FinanceReport>(`/finance/report${suffix}`);
}

export async function exportFinanceReport(
  filters: { start?: string; end?: string; status?: string },
  managerPassword: string,
) {
  const params = new URLSearchParams();
  if (filters.start) params.set("start", filters.start);
  if (filters.end) params.set("end", filters.end);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const response = await fetch(`${API_BASE_URL}/finance/export?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "x-manager-password": managerPassword,
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  return response.blob();
}

export function sendFinanceWhatsapp(payload: {
  phone: string;
  start?: string;
  end?: string;
  status?: string;
}, managerPassword: string) {
  return apiRequest<{ status: string; detail: string }>("/finance/send-whatsapp", {
    method: "POST",
    managerPassword,
    body: JSON.stringify(payload),
  });
}

export function updateManagerProfile(payload: { fullName?: string; phone?: string }) {
  return apiRequest<{ status: string }>("/admin/manager-profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function setManagerPassword(password: string) {
  return apiRequest<{ status: string }>("/auth/set-manager-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function verifyManagerPassword(password: string) {
  return apiRequest<{ status: string }>("/auth/verify-manager-password", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function authorizeAdminOperational(payload: { managerPassword?: string; accessKeyToken?: string }) {
  return apiRequest<{ status: string; method: string }>("/auth/authorize-admin-operational", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminWhatsappConfig() {
  return apiRequest<AdminWhatsAppConfig>("/admin/whatsapp/config");
}

export function updateAdminWhatsappConfig(phone: string, managerPassword: string) {
  return apiRequest<AdminWhatsAppConfig>("/admin/whatsapp/config", {
    method: "PUT",
    managerPassword,
    body: JSON.stringify({ phone }),
  });
}

export function relinkAdminWhatsapp(managerPassword: string) {
  return apiRequest<AdminWhatsAppConfig>("/admin/whatsapp/relink", {
    method: "POST",
    managerPassword,
  });
}

export function listSystemUsers() {
  return apiRequest<AdminUser[]>("/admin/system/users");
}

function composeAdminSystemRows(users: AdminUser[], keys: AccessKey[]): AdminSystemRow[] {
  const keysByUsedUserId = new Map<number, AccessKey>();
  const consumedKeyIds = new Set<number>();

  for (const key of keys) {
    if (key.usedByUserId !== null) {
      keysByUsedUserId.set(key.usedByUserId, key);
    }
  }

  const rows: AdminSystemRow[] = users.map((user) => {
    const linkedKey = keysByUsedUserId.get(user.id) ?? null;
    if (linkedKey) {
      consumedKeyIds.add(linkedKey.id);
    }

    return {
      rowType: "user",
      rowId: `user-${user.id}`,
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      companyId: user.companyId,
      companyName: user.companyName,
      contractCode: user.contractCode,
      contractStatus: user.contractStatus,
      userStatus: user.userStatus,
      phone: user.phone,
      isMaster: user.isMaster,
      accessKeyId: linkedKey?.id ?? null,
      accessKeyStatus: linkedKey?.accessKeyStatus ?? null,
      keyToken: linkedKey?.keyToken ?? null,
      keyLabel: linkedKey?.label ?? null,
      keyUsedAt: linkedKey?.usedAt ?? null,
      createdAt: user.createdAt,
    };
  });

  for (const key of keys) {
    if (consumedKeyIds.has(key.id)) {
      continue;
    }
    rows.push({
      rowType: "access-key",
      rowId: `access-key-${key.id}`,
      userId: null,
      email: null,
      fullName: null,
      companyId: null,
      companyName: key.companyName,
      contractCode: key.contractCode,
      contractStatus: key.contractStatus,
      userStatus: key.userStatus,
      phone: null,
      isMaster: false,
      accessKeyId: key.id,
      accessKeyStatus: key.accessKeyStatus,
      keyToken: key.keyToken,
      keyLabel: key.label,
      keyUsedAt: key.usedAt,
      createdAt: key.createdAt,
    });
  }

  return rows;
}

export async function listAdminSystemRows() {
  try {
    return await apiRequest<AdminSystemRow[]>("/admin/system/overview");
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error;
    }

    const [users, keys] = await Promise.all([listSystemUsers(), listAccessKeys()]);
    return composeAdminSystemRows(users, keys);
  }
}

export function createSystemUser(payload: {
  email: string;
  fullName?: string;
  companyName: string;
  phone?: string;
  password: string;
  isMaster: boolean;
}) {
  return apiRequest<AdminUser>("/admin/system/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSystemUser(
  userId: number,
  payload: { fullName?: string; companyName?: string; phone?: string; password?: string; isMaster?: boolean },
) {
  return apiRequest<AdminUser>(`/admin/system/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSystemUser(userId: number) {
  return apiRequest<{ status: string }>(`/admin/system/users/${userId}`, {
    method: "DELETE",
  });
}

export function toggleSystemUserStatus(userId: number) {
  return apiRequest<AdminUser>(`/admin/system/users/${userId}/toggle-status`, {
    method: "PATCH",
  });
}

export function listAccessKeys() {
  return apiRequest<AccessKey[]>("/admin/system/access-keys");
}

export function createAccessKey(payload: { label?: string; keyToken?: string }) {
  return apiRequest<AccessKey>("/admin/system/access-keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function toggleAccessKey(keyId: number) {
  return apiRequest<AccessKey>(`/admin/system/access-keys/${keyId}/toggle`, {
    method: "PATCH",
  });
}

export function toggleCompanyContractStatus(companyId: number) {
  return apiRequest<CompanyContractStatusPayload>(`/admin/system/companies/${companyId}/toggle-contract-status`, {
    method: "PATCH",
  });
}

export async function exportSystemAccessKeys() {
  const response = await fetch(`${API_BASE_URL}/admin/system/access-keys/export`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });

  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }

  return response.blob();
}

export function fetchWhatsappStatus() {
  return apiRequest<{ connected: boolean; registered: boolean; lastQr?: string | null; detail?: string | null; linkMode?: string | null }>(
    "/whatsapp/status",
  );
}

export function listTeamMembers(managerPassword: string) {
  return apiRequest<TeamMember[]>("/team/members", { managerPassword });
}

export function createTeamMember(name: string, managerPassword: string) {
  return apiRequest<TeamMember>("/team/members", {
    method: "POST",
    managerPassword,
    body: JSON.stringify({ name }),
  });
}

export function updateTeamMember(memberId: number, payload: { name?: string; isActive?: boolean }, managerPassword: string) {
  return apiRequest<TeamMember>(`/team/members/${memberId}`, {
    method: "PUT",
    managerPassword,
    body: JSON.stringify(payload),
  });
}

export function deleteTeamMember(memberId: number, managerPassword: string) {
  return apiRequest<{ status: string }>(`/team/members/${memberId}`, {
    method: "DELETE",
    managerPassword,
  });
}

export function fetchTeamEntries(entryDate: string, managerPassword: string) {
  return apiRequest<TeamCostEntry[]>(`/team/entries?entryDate=${encodeURIComponent(entryDate)}`, {
    managerPassword,
  });
}

export function saveTeamEntries(entryDate: string, items: Array<{ memberId: number; amount: number; tipAmount: number }>, managerPassword: string) {
  return apiRequest<TeamCostEntry[]>("/team/entries/batch", {
    method: "POST",
    managerPassword,
    body: JSON.stringify({ entryDate, items }),
  });
}

export function updateTeamEntry(entryId: number, amount: number, tipAmount: number, managerPassword: string) {
  return apiRequest<TeamCostEntry>(`/team/entries/${entryId}`, {
    method: "PUT",
    managerPassword,
    body: JSON.stringify({ amount, tipAmount }),
  });
}

export function deleteTeamEntry(entryId: number, managerPassword: string) {
  return apiRequest<{ status: string }>(`/team/entries/${entryId}`, {
    method: "DELETE",
    managerPassword,
  });
}

export function listOperationalCostTypes(managerPassword: string) {
  return apiRequest<OperationalCostType[]>("/operational-costs/types", { managerPassword });
}

export function createOperationalCostType(name: string, managerPassword: string) {
  return apiRequest<OperationalCostType>("/operational-costs/types", {
    method: "POST",
    managerPassword,
    body: JSON.stringify({ name }),
  });
}

export function updateOperationalCostType(costTypeId: number, payload: { name?: string; isActive?: boolean }, managerPassword: string) {
  return apiRequest<OperationalCostType>(`/operational-costs/types/${costTypeId}`, {
    method: "PUT",
    managerPassword,
    body: JSON.stringify(payload),
  });
}

export function deleteOperationalCostType(costTypeId: number, managerPassword: string) {
  return apiRequest<{ status: string }>(`/operational-costs/types/${costTypeId}`, {
    method: "DELETE",
    managerPassword,
  });
}

export function fetchOperationalCostEntries(entryDate: string, managerPassword: string) {
  return apiRequest<OperationalCostEntry[]>(`/operational-costs/entries?entryDate=${encodeURIComponent(entryDate)}`, {
    managerPassword,
  });
}

export function saveOperationalCostEntries(entryDate: string, items: Array<{ costTypeId: number; amount: number }>, managerPassword: string) {
  return apiRequest<OperationalCostEntry[]>("/operational-costs/entries/batch", {
    method: "POST",
    managerPassword,
    body: JSON.stringify({ entryDate, items }),
  });
}

export function updateOperationalCostEntry(entryId: number, amount: number, managerPassword: string) {
  return apiRequest<OperationalCostEntry>(`/operational-costs/entries/${entryId}`, {
    method: "PUT",
    managerPassword,
    body: JSON.stringify({ amount }),
  });
}

export function deleteOperationalCostEntry(entryId: number, managerPassword: string) {
  return apiRequest<{ status: string }>(`/operational-costs/entries/${entryId}`, {
    method: "DELETE",
    managerPassword,
  });
}