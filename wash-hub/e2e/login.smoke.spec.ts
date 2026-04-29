import { expect, test } from "@playwright/test";

import { loginAsOperationalUser, skipIfMissingCredentials } from "./helpers";


test.describe("login smoke", () => {
  test.skip(skipIfMissingCredentials(), "Configure E2E_USER_EMAIL e E2E_USER_PASSWORD para executar o smoke de login.");

  test("faz login e carrega o dashboard", async ({ page }) => {
    await loginAsOperationalUser(page);

    await expect(page.getByText("Dashboard").first()).toBeVisible();
    await expect(page.getByText("Nova Ordem").first()).toBeVisible();
  });
});
