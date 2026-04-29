import { expect, Page } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const apiBaseUrl = process.env.E2E_API_BASE_URL || "http://127.0.0.1:8011";

export function skipIfMissingCredentials() {
  return !email || !password;
}

export async function loginViaApi(page: Page) {
  if (!email || !password) {
    throw new Error("Configure E2E_USER_EMAIL e E2E_USER_PASSWORD antes de rodar os testes E2E.");
  }

  const response = await page.request.post(`${apiBaseUrl}/auth/login`, {
    data: {
      email,
      password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Falha ao autenticar via API para o E2E: HTTP ${response.status()}`);
  }

  return (await response.json()) as { access_token: string };
}

export async function loginAsOperationalUser(page: Page) {
  if (!email || !password) {
    throw new Error("Configure E2E_USER_EMAIL e E2E_USER_PASSWORD antes de rodar os testes E2E.");
  }

  await page.goto("/login");
  await page.waitForTimeout(750);
  const emailField = page.getByPlaceholder("seu@email.com");
  const passwordField = page.getByPlaceholder("••••••••").first();

  await emailField.click();
  await emailField.fill(email);
  await expect(emailField).toHaveValue(email);

  await passwordField.click();
  await passwordField.fill(password);
  await expect(passwordField).toHaveValue(password);

  await page.getByRole("button", { name: "Entrar" }).click();

  const loginError = page.getByText(
    /Falha ao autenticar|Usuario ou senha invalidos|Conta bloqueada temporariamente|Contrato inativo|Chave inativa|value is not a valid email address/i,
  );
  if (await loginError.isVisible().catch(() => false)) {
    throw new Error((await loginError.textContent()) || "Falha ao autenticar pela UI");
  }

  await page.waitForFunction(() => Boolean(window.localStorage.getItem("washapp2.accessToken")), undefined, {
    timeout: 10000,
  });

  if (/\/login\/?$/.test(page.url())) {
    await page.goto("/");
  }

  await expect(page).toHaveURL(/\/$/);
}

export async function authenticateViaApi(page: Page) {
  const payload = await loginViaApi(page);
  await page.addInitScript((token) => {
    window.localStorage.setItem("washapp2.accessToken", token);
  }, payload.access_token);
}

export async function createOrderViaApi(
  page: Page,
  payload: {
    customerName: string;
    phone: string;
    vehicle: string;
    plate: string;
    color: string;
    washType?: string;
    basePrice?: number;
    total?: number;
  },
) {
  const auth = await loginViaApi(page);
  const response = await page.request.post(`${apiBaseUrl}/orders`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
    },
    data: {
      customerName: payload.customerName,
      phone: payload.phone,
      vehicle: payload.vehicle,
      plate: payload.plate,
      color: payload.color,
      washType: payload.washType ?? "completa",
      basePrice: payload.basePrice ?? 65,
      total: payload.total ?? 65,
      sendWhatsapp: false,
      items: [],
    },
  });

  if (!response.ok()) {
    throw new Error(`Falha ao criar ordem via API para o E2E: HTTP ${response.status()}`);
  }

  return (await response.json()) as { id: number };
}

export async function updateOrderStatusViaApi(page: Page, orderId: number, status: string) {
  const auth = await loginViaApi(page);
  const response = await page.request.put(`${apiBaseUrl}/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${auth.access_token}`,
    },
    data: { status },
  });

  if (!response.ok()) {
    throw new Error(`Falha ao atualizar ordem via API para o E2E: HTTP ${response.status()}`);
  }
}
