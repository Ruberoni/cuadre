import { expect, test } from "@playwright/test";
import { ADMIN, SEED_USERS, signIn, signInRequest } from "../support/auth.ts";
import { withE2eDatabase } from "../support/database.ts";

const WEB_ORIGIN = `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 4173}`;

async function seedPurchasingFixtures(page: Parameters<typeof signIn>[0]) {
  await withE2eDatabase(async (sql) => {
    await sql`truncate table purchasing.purchase_orders, partners.partners, catalog.products restart identity cascade`;
  });

  await signInRequest(page.request, "", ADMIN);
  const headers = { origin: WEB_ORIGIN };

  const supplierRes = await page.request.post("/api/suppliers", {
    headers,
    data: { rif: "J-30123456-1", name: "Distribuidora Andina, C.A." },
  });
  expect(supplierRes.status()).toBe(201);
  const supplier = (await supplierRes.json()) as { id: string };

  const harinaRes = await page.request.post("/api/products", {
    headers,
    data: {
      sku: "HAR-PAN-1K",
      name: "Harina de maíz precocida 1 kg",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    },
  });
  expect(harinaRes.status()).toBe(201);

  const atunRes = await page.request.post("/api/products", {
    headers,
    data: {
      sku: "ATU-LAT-170",
      name: "Atún en aceite lata 170 g",
      unitOfMeasure: "BOX",
      salePrice: { minorUnits: 210, currency: "USD" },
      taxRate: "GENERAL",
    },
  });
  expect(atunRes.status()).toBe(201);

  const polloRes = await page.request.post("/api/products", {
    headers,
    data: {
      sku: "POL-FRE-KG",
      name: "Pollo fresco entero",
      unitOfMeasure: "KILOGRAM",
      salePrice: { minorUnits: 410, currency: "USD" },
      taxRate: "EXEMPT",
    },
  });
  expect(polloRes.status()).toBe(201);

  await page.context().clearCookies();
  return { supplierId: supplier.id };
}

test.describe("Órdenes de compra (borradores)", () => {
  test("purchasing user creates, edits and deletes a USD draft with mixed IVA (AC #1, #2)", async ({
    page,
  }) => {
    await seedPurchasingFixtures(page);
    await signIn(page, SEED_USERS.purchasing);
    await page.goto("/ordenes-de-compra");
    await expect(page).toHaveTitle("Órdenes de compra · Cuadre");

    // Navigate to new purchase order
    await page.getByRole("link", { name: "Nueva orden de compra" }).click();
    await expect(page).toHaveURL(/\/ordenes-de-compra\/nueva/);

    // Select supplier Distribuidora Andina, C.A.
    await page.getByRole("combobox", { name: "Proveedor" }).click();
    await page.getByRole("option", { name: /Distribuidora Andina, C\.A\./ }).click();

    // Add line 1: HAR-PAN-1K (Exento, Bulto) 100 x $ 1,10
    await page.getByRole("button", { name: "Agregar línea" }).click();
    await page.getByRole("combobox", { name: "Producto 1" }).click();
    await page.getByRole("option", { name: /HAR-PAN-1K/ }).click();
    await page.getByLabel("Cantidad 1").fill("100");
    await page.getByLabel("Costo unitario 1").fill("1,10");

    // Add line 2: ATU-LAT-170 (General 16 %, Caja) 50 x $ 2,00
    await page.getByRole("button", { name: "Agregar línea" }).click();
    await page.getByRole("combobox", { name: "Producto 2" }).click();
    await page.getByRole("option", { name: /ATU-LAT-170/ }).click();
    await page.getByLabel("Cantidad 2").fill("50");
    await page.getByLabel("Costo unitario 2").fill("2,00");

    // Live totals check: subtotal $ 210,00, IVA 16 % $ 16,00, total $ 226,00
    await expect(page.getByText("$ 210,00")).toBeVisible();
    await expect(page.getByText("$ 16,00")).toBeVisible();
    await expect(page.getByText("$ 226,00")).toBeVisible();

    // Save draft
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByRole("status")).toHaveText("Borrador guardado.");
    await expect(page).toHaveURL(/\/ordenes-de-compra/);

    const createdRow = page
      .getByRole("row", { name: /Distribuidora Andina, C\.A\..*226,00/ })
      .first();
    await expect(createdRow).toContainText("Borrador");

    // Open draft, edit quantity and remove second line
    await createdRow.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/ordenes-de-compra\/[0-9a-f-]+/);
    await page.getByLabel("Cantidad 1").fill("120");
    await page.getByRole("button", { name: "Quitar línea 2" }).click();
    await expect(page.getByText("$ 132,00").first()).toBeVisible();

    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByRole("status")).toHaveText("Borrador guardado.");
    const editedRow = page
      .getByRole("row", { name: /Distribuidora Andina, C\.A\..*132,00/ })
      .first();
    await expect(editedRow).toBeVisible();

    // Delete draft via confirmation dialog
    await editedRow.getByRole("link").first().click();
    await page.getByRole("button", { name: "Eliminar borrador" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Borrador eliminado.");
  });

  test("validates quantity precision, future date, VES currency and empty-lines draft (AC #4, #5, #6, #8)", async ({
    page,
  }) => {
    await seedPurchasingFixtures(page);
    await signIn(page, SEED_USERS.purchasing);
    await page.goto("/ordenes-de-compra/nueva");

    await page.getByRole("combobox", { name: "Proveedor" }).click();
    await page.getByRole("option", { name: /Distribuidora Andina, C\.A\./ }).click();

    // Future date -> error
    await page.getByLabel("Fecha").fill("31/12/2099");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("La fecha no puede ser futura.")).toBeVisible();

    // Fix date to a valid past date and test empty-lines draft (AC #8)
    await page.getByLabel("Fecha").fill("20/11/2026");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByRole("status")).toHaveText("Borrador guardado.");

    // New VES draft with quantity precision checks (AC #4, #6)
    await page.goto("/ordenes-de-compra/nueva");
    await page.getByRole("combobox", { name: "Proveedor" }).click();
    await page.getByRole("option", { name: /Distribuidora Andina, C\.A\./ }).click();
    await page.getByRole("combobox", { name: "Moneda" }).click();
    await page.getByRole("option", { name: "VES (Bs.)" }).click();

    // 2,5 Bulto -> QUANTITY_NOT_WHOLE
    await page.getByRole("button", { name: "Agregar línea" }).click();
    await page.getByRole("combobox", { name: "Producto 1" }).click();
    await page.getByRole("option", { name: /HAR-PAN-1K/ }).click();
    await page.getByLabel("Cantidad 1").fill("2,5");
    await page.getByLabel("Costo unitario 1").fill("100,00");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Esta unidad solo admite números enteros.")).toBeVisible();

    // Switch to Kilogramo: 12,3456 -> QUANTITY_TOO_PRECISE, then 12,345 -> accepted in Bs.
    await page.getByRole("combobox", { name: "Producto 1" }).click();
    await page.getByRole("option", { name: /POL-FRE-KG/ }).click();
    await page.getByLabel("Cantidad 1").fill("12,3456");
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByText("Usar como máximo 3 decimales.")).toBeVisible();

    await page.getByLabel("Cantidad 1").fill("12,345");
    await expect(page.getByText("Bs. 1.234,50").first()).toBeVisible();
    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByRole("status")).toHaveText("Borrador guardado.");
  });

  test("warehouse sees list and order read-only; sales has no access (AC #7)", async ({ page }) => {
    const { supplierId } = await seedPurchasingFixtures(page);

    // Seed one draft order as purchasing
    await signInRequest(page.request, "", SEED_USERS.purchasing);
    const createRes = await page.request.post("/api/purchase-orders", {
      headers: { origin: WEB_ORIGIN },
      data: {
        supplierId,
        currency: "USD",
        documentDate: "2026-11-20",
        lines: [],
      },
    });
    expect(createRes.status()).toBe(201);
    await page.context().clearCookies();

    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await signIn(page, SEED_USERS.warehouse);
    await page.goto("/ordenes-de-compra");
    await expect(page.getByRole("link", { name: "Órdenes de compra" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva orden de compra" })).toBeHidden();

    // Open order read-only (no save/delete buttons, no 403 console errors)
    const firstLink = page.getByRole("table").getByRole("link").first();
    await firstLink.click();
    await expect(page.getByRole("link", { name: "Volver" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar borrador" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Eliminar borrador" })).toBeHidden();
    expect(consoleErrors).toEqual([]);

    // Sales user does not see nav link and gets forbidden alert on direct URL
    await page.context().clearCookies();
    await signIn(page, SEED_USERS.sales);
    await page.goto("/ordenes-de-compra");
    await expect(page.getByRole("link", { name: "Órdenes de compra" })).toBeHidden();
    await expect(page.getByRole("alert")).toContainText(
      "Solo un administrador, compras o almacén puede ver órdenes de compra.",
    );
  });
});
