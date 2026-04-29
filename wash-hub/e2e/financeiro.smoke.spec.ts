import { expect, test } from "@playwright/test";

import { authenticateViaApi, skipIfMissingCredentials } from "./helpers";


test.describe("financeiro smoke", () => {
  test.skip(skipIfMissingCredentials(), "Configure E2E_USER_EMAIL e E2E_USER_PASSWORD para executar o smoke financeiro.");

  test("carrega resumo financeiro e abre senha gerencial para envio no WhatsApp", async ({ page }) => {
    await authenticateViaApi(page);
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "washapp2.finance.filters",
        JSON.stringify({ start: "2026-04-29", end: "2026-04-29", status: "all" }),
      );
    });

    await page.goto("/financeiro");

    await expect(page.getByRole("heading", { name: "Financeiro Operacional" })).toBeVisible();
    await expect(page.getByText("Faturamento Total")).toBeVisible();
    await expect(page.getByRole("main").getByText("Custos Operacionais")).toBeVisible();
    await expect(page.getByRole("button", { name: "Aplicar Filtro" })).toBeVisible();

    await page.getByRole("button", { name: /WhatsApp/i }).click();
    await expect(page.getByRole("heading", { name: "Senha gerencial" })).toBeVisible();
  });
});