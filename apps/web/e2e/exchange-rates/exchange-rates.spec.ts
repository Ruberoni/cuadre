import { expect, type Page, test } from "@playwright/test";
import { addDays, formatBcvRate, formatDate, todayCaracas } from "../../src/lib/format/index.ts";
import { SEED_USERS, signIn } from "../support/auth.ts";
import { resetDatabase } from "../support/database.ts";
import { freezeExchangeRate, givenExchangeRate } from "../support/exchange-rates.ts";

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await signIn(page);
});

async function fillAndSubmitRateDialog(
  page: Page,
  { date, rate }: { date?: string; rate: string },
) {
  const dialog = page.getByRole("dialog");
  if (date !== undefined) {
    await dialog.getByLabel("Fecha").fill(date);
  }
  await dialog.getByLabel("Tasa").fill(rate);
  await dialog.getByRole("button", { name: "Guardar tasa" }).click();
}

test.describe("record and list BCV rates (admin)", () => {
  test("an admin records a rate and sees it formatted to 8 decimals in the list and header", async ({
    page,
  }) => {
    const today = todayCaracas();
    const todayDisplay = formatDate(today);

    await page.goto("/tasas-bcv");
    await expect(page).toHaveTitle("Tasas BCV · Cuadre");
    await expect(page.getByText("Aún no hay tasas BCV")).toBeVisible();

    await page.getByRole("button", { name: "Registrar tasa" }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar tasa BCV" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Fecha")).toBeFocused();
    await expect(dialog.getByLabel("Fecha")).toHaveValue(todayDisplay);

    await fillAndSubmitRateDialog(page, { date: todayDisplay, rate: "36,5123" });

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText(`Tasa del ${todayDisplay} registrada.`);

    const row = page.getByRole("row", { name: new RegExp(todayDisplay) });
    await expect(row).toContainText(todayDisplay);
    await expect(row).toContainText(formatBcvRate("36.5123"));

    const header = page.locator("header");
    await expect(header).toContainText(`Tasa BCV ${todayDisplay}`);
    await expect(header).toContainText(formatBcvRate("36.5123"));
  });

  test("rejects 9 decimals, zero, negative values, invalid dates, duplicate date, and >7 days ahead", async ({
    page,
    request,
  }) => {
    const today = todayCaracas();
    const todayDisplay = formatDate(today);
    await givenExchangeRate(request, { date: today, rate: "36.5123" });

    await page.goto("/tasas-bcv");
    await page.getByRole("button", { name: "Registrar tasa" }).click();
    const dialog = page.getByRole("dialog");

    // 9 decimals
    await fillAndSubmitRateDialog(page, { date: todayDisplay, rate: "36,123456789" });
    await expect(dialog.getByText("Usar como máximo 8 decimales.")).toBeVisible();
    await expect(dialog.getByLabel("Tasa")).toBeFocused();

    // Zero
    await fillAndSubmitRateDialog(page, { rate: "0" });
    await expect(dialog.getByText("La tasa debe ser mayor que 0.")).toBeVisible();
    await expect(dialog.getByLabel("Tasa")).toBeFocused();

    // Negative
    await fillAndSubmitRateDialog(page, { rate: "-36,5" });
    await expect(dialog.getByText("La tasa debe ser mayor que 0.")).toBeVisible();
    await expect(dialog.getByLabel("Tasa")).toBeFocused();

    // Invalid calendar date
    await fillAndSubmitRateDialog(page, { date: "30/02/2026", rate: "36,5" });
    await expect(
      dialog.getByText("Escribir una fecha válida con formato dd/mm/aaaa."),
    ).toBeVisible();
    await expect(dialog.getByLabel("Fecha")).toBeFocused();

    // +8 days ahead
    const plus8Display = formatDate(addDays(today, 8));
    await fillAndSubmitRateDialog(page, { date: plus8Display, rate: "36,5" });
    await expect(dialog.getByText("La fecha no puede superar 7 días desde hoy.")).toBeVisible();
    await expect(dialog.getByLabel("Fecha")).toBeFocused();

    // Duplicate date
    await fillAndSubmitRateDialog(page, { date: todayDisplay, rate: "36,6" });
    await expect(
      dialog.getByText(
        `Ya existe una tasa para el ${todayDisplay}. Para cambiarla, corregir la existente.`,
      ),
    ).toBeVisible();
    await expect(dialog.getByLabel("Fecha")).toBeFocused();

    // +7 days ahead is accepted
    const plus7Display = formatDate(addDays(today, 7));
    await fillAndSubmitRateDialog(page, { date: plus7Display, rate: "36,75" });
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText(`Tasa del ${plus7Display} registrada.`);
  });

  test("corrects an unfrozen rate and makes frozen rates read-only", async ({ page, request }) => {
    const today = todayCaracas();
    const yesterday = addDays(today, -1);
    const todayDisplay = formatDate(today);
    const yesterdayDisplay = formatDate(yesterday);

    await givenExchangeRate(request, { date: today, rate: "36.5123" });
    await givenExchangeRate(request, { date: yesterday, rate: "36.4" });
    await freezeExchangeRate(yesterday);

    await page.goto("/tasas-bcv");

    // Frozen row has Congelada badge and no Corregir button
    const frozenRow = page.getByRole("row", { name: new RegExp(yesterdayDisplay) });
    await expect(frozenRow).toContainText("Congelada");
    await expect(frozenRow.getByRole("button", { name: "Corregir" })).toHaveCount(0);

    // Unfrozen row can be corrected
    const todayRow = page.getByRole("row", { name: new RegExp(todayDisplay) });
    await todayRow.getByRole("button", { name: "Corregir" }).click();

    const dialog = page.getByRole("dialog", { name: "Corregir tasa BCV" });
    await expect(dialog.getByLabel("Fecha")).toHaveAttribute("readonly", "");
    await expect(dialog.getByLabel("Tasa")).toBeFocused();

    await dialog.getByLabel("Tasa").fill("36,52");
    await dialog.getByRole("button", { name: "Guardar tasa" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText(`Tasa del ${todayDisplay} corregida.`);
    await expect(todayRow).toContainText(formatBcvRate("36.52"));
    await expect(page.locator("header")).toContainText(formatBcvRate("36.52"));

    // If a rate is frozen while the dialog is open, saving shows RATE_ALREADY_FROZEN alert
    await todayRow.getByRole("button", { name: "Corregir" }).click();
    await freezeExchangeRate(today);
    await dialog.getByLabel("Tasa").fill("36,6");
    await dialog.getByRole("button", { name: "Guardar tasa" }).click();

    const alert = dialog.getByRole("alert");
    await expect(alert).toHaveText(
      "Esta tasa ya fue usada en un documento emitido y no se puede corregir.",
    );
    await expect(alert).toBeFocused();
  });

  test("paginates 30 rates newest-first and redirects an out-of-range page", async ({
    page,
    request,
  }) => {
    const today = todayCaracas();
    for (let i = 0; i < 30; i++) {
      await givenExchangeRate(request, {
        date: addDays(today, -i),
        rate: `36.${String(5000 + i)}`,
      });
    }

    await page.goto("/tasas-bcv");
    await expect(page.getByText("1–25 de 30 tasas")).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(25);
    await expect(rows.first()).toContainText(formatDate(today));

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(page.getByText("26–30 de 30 tasas")).toBeVisible();
    await expect(rows).toHaveCount(5);

    await page.goto("/tasas-bcv?page=9");
    await expect(page.getByText("26–30 de 30 tasas")).toBeVisible();
  });

  test("a failed list load shows the error with Reintentar, which loads again", async ({
    page,
    request,
  }) => {
    const today = todayCaracas();
    await givenExchangeRate(request, { date: today, rate: "36.5" });
    await page.route("**/api/exchange-rates?*", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR" } }),
    );

    await page.goto("/tasas-bcv");
    await expect(
      page.getByText(
        "No se pudo cargar la lista de tasas BCV. Revisar la conexión e intentar de nuevo.",
      ),
    ).toBeVisible();

    await page.unroute("**/api/exchange-rates?*");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("row", { name: new RegExp(formatDate(today)) })).toBeVisible();
  });
});

test.describe("header rate states and read-only role", () => {
  test("admin sees Sin tasa BCV + Registrar tasa link, which opens the record dialog", async ({
    page,
  }) => {
    await page.goto("/productos");

    const header = page.locator("header");
    await expect(header.getByText("Sin tasa BCV")).toBeVisible();
    await header.getByRole("link", { name: "Registrar tasa" }).click();

    await expect(page).toHaveURL(/\/tasas-bcv/);
    await expect(page.getByRole("dialog", { name: "Registrar tasa BCV" })).toBeVisible();
  });

  test("header ignores future-dated rates and falls back to the latest earlier rate", async ({
    page,
    request,
  }) => {
    const today = todayCaracas();
    const tomorrow = addDays(today, 1);
    const earlier = addDays(today, -3);

    // Only future rate -> still Sin tasa BCV
    await givenExchangeRate(request, { date: tomorrow, rate: "37.0" });
    await page.goto("/productos");
    await expect(page.locator("header").getByText("Sin tasa BCV")).toBeVisible();

    // Earlier rate + future rate -> shows earlier rate with its own date
    await givenExchangeRate(request, { date: earlier, rate: "36.4" });
    await page.reload();
    const header = page.locator("header");
    await expect(header).toContainText(`Tasa BCV ${formatDate(earlier)}`);
    await expect(header).toContainText(formatBcvRate("36.4"));

    // Today's rate + future rate -> shows today's rate
    await givenExchangeRate(request, { date: today, rate: "36.5123" });
    await page.reload();
    await expect(header).toContainText(`Tasa BCV ${formatDate(today)}`);
    await expect(header).toContainText(formatBcvRate("36.5123"));
  });

  test("header shows nothing when the current-rate request fails", async ({ page }) => {
    await page.route("**/api/exchange-rates/current", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR" } }),
    );
    await page.goto("/productos");

    const header = page.locator("header");
    await expect(header.getByRole("heading", { name: "Productos" })).toBeVisible();
    await expect(header.getByText("Sin tasa BCV")).toHaveCount(0);
    await expect(header.getByText(/Tasa BCV/)).toHaveCount(0);
  });

  test("sales role sees read-only header and read-only Tasas BCV screen", async ({
    page,
    request,
  }) => {
    await page.context().clearCookies();
    await signIn(page, SEED_USERS.sales);
    await page.goto("/tasas-bcv");

    const header = page.locator("header");
    await expect(header.getByText("Sin tasa BCV")).toBeVisible();
    await expect(header.getByText("Un administrador debe registrarla.")).toBeVisible();
    await expect(header.getByRole("link", { name: "Registrar tasa" })).toHaveCount(0);

    await expect(page.getByText("Aún no hay tasas BCV")).toBeVisible();
    await expect(page.getByText("Un administrador debe registrarlas.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar tasa" })).toHaveCount(0);

    const today = todayCaracas();
    await givenExchangeRate(request, { date: today, rate: "36.5123" });
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(formatDate(today)) })).toBeVisible();
    await expect(page.getByRole("button", { name: "Corregir" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Registrar tasa" })).toHaveCount(0);
  });
});
