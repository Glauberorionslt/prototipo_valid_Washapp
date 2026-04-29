import { expect, test } from "@playwright/test";

import { authenticateViaApi, skipIfMissingCredentials } from "./helpers";


test.describe("mobile navigation smoke", () => {
  test.skip(skipIfMissingCredentials(), "Configure E2E_USER_EMAIL e E2E_USER_PASSWORD para executar o smoke mobile.");

  test.use({ viewport: { width: 390, height: 844 } });

  test("abre o menu mobile e navega para clientes", async ({ page }) => {
    await authenticateViaApi(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);

    await page.getByRole("button", { name: "Abrir menu de navegacao" }).click();
    const mobileDrawer = page.getByRole("dialog");
    const clientsLink = mobileDrawer.getByRole("link", { name: "Clientes" });
    await expect(clientsLink).toBeVisible();
    await clientsLink.click();

    await expect(page).toHaveURL(/\/clientes$/);
    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
  });
});
