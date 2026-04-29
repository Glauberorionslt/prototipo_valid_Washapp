import { expect, test } from "@playwright/test";

import { authenticateViaApi, skipIfMissingCredentials } from "./helpers";


test.describe("nova ordem smoke", () => {
  test.skip(skipIfMissingCredentials(), "Configure E2E_USER_EMAIL e E2E_USER_PASSWORD para executar o smoke de nova ordem.");

  test("cria uma nova ordem avulsa pela interface", async ({ page }) => {
    const uniqueSuffix = Date.now().toString().slice(-6);

    await authenticateViaApi(page);
    await page.goto("/nova-ordem");

    await expect(page.getByRole("heading", { name: "Nova Ordem de Lavagem" })).toBeVisible();
    await page.getByPlaceholder("Nome do cliente").fill(`Cliente E2E ${uniqueSuffix}`);
    await page.getByPlaceholder("11999990000").fill("11999998888");
    await page.getByPlaceholder("Honda Civic").first().fill("HB20 E2E");
    await page.getByPlaceholder("ABC1D23").fill(`E2E${uniqueSuffix.slice(-4)}`);
    await page.getByPlaceholder("Prata").fill("Branco");
    await page.getByRole("button", { name: /Salvar Ordem/i }).click();

    await expect(page.getByText("Ordem criada com sucesso.")).toBeVisible();
  });
});
