import { expect, test } from "@playwright/test";

import { authenticateViaApi, createOrderViaApi, skipIfMissingCredentials, updateOrderStatusViaApi } from "./helpers";


test.describe("dashboard whatsapp smoke", () => {
  test.skip(skipIfMissingCredentials(), "Configure E2E_USER_EMAIL e E2E_USER_PASSWORD para executar o smoke de WhatsApp.");

  test("aciona Avisar em uma ordem pronta", async ({ page }) => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    const order = await createOrderViaApi(page, {
      customerName: `Cliente WhatsApp ${uniqueSuffix}`,
      phone: "11999997777",
      vehicle: "Onix E2E",
      plate: `WA${uniqueSuffix.slice(-4)}`,
      color: "Prata",
    });
    await updateOrderStatusViaApi(page, order.id, "pronto");

    await authenticateViaApi(page);
    await page.goto("/");

    const prontoGroupButton = page.getByRole("button", { name: /Pronto/i }).first();
    await prontoGroupButton.click();

    const orderRow = page.locator("li").filter({ hasText: `Cliente WhatsApp ${uniqueSuffix}` }).first();
    await expect(orderRow).toBeVisible();
    await orderRow.getByRole("button", { name: /Avisar/i }).click();

    await expect(page.locator("p.text-primary").filter({ hasText: /.+/ }).first()).toBeVisible();
  });
});
