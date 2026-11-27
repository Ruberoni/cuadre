import { expect, test } from "@playwright/test";
import { ADMIN, SEED_USERS, signIn, signInRequest } from "../support/auth.ts";
import { withE2eDatabase } from "../support/database.ts";

const WEB_ORIGIN = `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 4173}`;

async function seedIssuedPurchaseOrder(page: Parameters<typeof signIn>[0]) {
  await withE2eDatabase(async (sql) => {
    await sql`truncate table inventory.stock_movements, inventory.stock_balances, purchasing.goods_receipts, purchasing.purchase_orders, exchange_rates.rates, partners.partners, catalog.products restart identity cascade`;
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
      salePrice: { minorUnits: 900, currency: "USD" },
      taxRate: "EXEMPT",
    },
  });
  expect(harinaRes.status()).toBe(201);
  const harina = (await harinaRes.json()) as { id: string };

  const atunRes = await page.request.post("/api/products", {
    headers,
    data: {
      sku: "ATU-LAT-170",
      name: "Atún en aceite lata 170 g",
      unitOfMeasure: "BOX",
      salePrice: { minorUnits: 300, currency: "USD" },
      taxRate: "GENERAL",
    },
  });
  expect(atunRes.status()).toBe(201);
  const atun = (await atunRes.json()) as { id: string };

  const rateRes = await page.request.post("/api/exchange-rates", {
    headers,
    data: { date: "2026-11-20", rate: "36.5123" },
  });
  expect(rateRes.status()).toBe(201);

  const poRes = await page.request.post("/api/purchase-orders", {
    headers,
    data: {
      supplierId: supplier.id,
      currency: "USD",
      documentDate: "2026-11-20",
      lines: [
        { productId: harina.id, quantity: "100", unitCost: { minorUnits: 700, currency: "USD" } },
        { productId: atun.id, quantity: "50", unitCost: { minorUnits: 200, currency: "USD" } },
      ],
    },
  });
  expect(poRes.status()).toBe(201);
  const po = (await poRes.json()) as { id: string };

  const issuePoRes = await page.request.post(`/api/purchase-orders/${po.id}/issue`, { headers });
  expect(issuePoRes.status()).toBe(200);

  await page.context().clearCookies();
  return { purchaseOrderId: po.id };
}

test.describe("Recepciones de mercancía", () => {
  test("warehouse receives an issued order partially, edits unit cost, validates errors, and closes the PO (AC #2, #6, #7, #9)", async ({
    page,
  }) => {
    const { purchaseOrderId } = await seedIssuedPurchaseOrder(page);

    await signIn(page, SEED_USERS.warehouse);
    await page.goto(`/ordenes-de-compra/${purchaseOrderId}`);
    await expect(page.getByRole("link", { name: "Recibir mercancía" })).toBeVisible();
    await page.getByRole("link", { name: "Recibir mercancía" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/recepciones-de-mercancia/nueva\\?orden=${purchaseOrderId}`),
    );

    // Lines pre-filled from the PO
    await expect(page.getByLabel("Recibido 1")).toHaveValue("100");
    await expect(page.getByLabel("Costo unitario 1")).toHaveValue("7,00");

    // Missing invoice/control numbers + quantity > ordered -> field messages (AC #7, #9)
    await page.getByLabel("Fecha").fill("20/11/2026");
    await page.getByLabel("Recibido 1").fill("120");
    await page.getByRole("button", { name: "Guardar borrador" }).click();

    await expect(page.getByText("Falta el n.º de factura del proveedor.")).toBeVisible();
    await expect(page.getByText("Falta el n.º de control.")).toBeVisible();
    await expect(
      page.getByText("La cantidad no puede superar lo pedido en la orden."),
    ).toBeVisible();

    // Fill numbers, receive 80 of 100, edit unit cost to $7,20 (AC #2, #6), and remove line 2
    await page.getByLabel("N.º de factura del proveedor").fill("F-00012345");
    await page.getByLabel("N.º de control").fill("00-00012345");
    await page.getByLabel("Recibido 1").fill("80");
    await page.getByLabel("Costo unitario 1").fill("7,20");
    await page.getByRole("button", { name: "Quitar línea 2" }).click();

    // 80 × $7,20 = $576,00
    await expect(page.getByText("$ 576,00").first()).toBeVisible();

    await page.getByRole("button", { name: "Guardar borrador" }).click();
    await expect(page.getByRole("status")).toHaveText("Borrador guardado.");
    await expect(page).toHaveURL(/\/recepciones-de-mercancia\/[0-9a-f-]+/);

    // Issue the receipt via AlertDialog
    await page.getByRole("button", { name: "Emitir" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("¿Emitir recepción de mercancía?");
    await dialog.getByRole("button", { name: "Emitir", exact: true }).click();

    await expect(page.getByRole("status")).toHaveText("Recepción de mercancía emitida.");
    const main = page.getByRole("main");
    await expect(main.getByText("Emitido", { exact: true })).toBeVisible();
    await expect(main.getByText("Bs. 36,51230000")).toBeVisible();

    // Parent PO shows Recibida, link to receipt, and STILL shows original $7,00 unit cost (AC #2, #6)
    await page.goto(`/ordenes-de-compra/${purchaseOrderId}`);
    await expect(main.getByText("Recibida", { exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: "Ver recepción de mercancía" })).toBeVisible();
    await expect(main.getByRole("link", { name: "Recibir mercancía" })).toBeHidden();
    await expect(main.getByText("$ 7,00")).toBeVisible();

    // Cannot select this PO again in /recepciones-de-mercancia/nueva
    await page.goto("/recepciones-de-mercancia/nueva");
    await page.getByRole("combobox", { name: "Orden de compra" }).click();
    await expect(
      page.getByText("No hay órdenes de compra emitidas pendientes por recibir."),
    ).toBeVisible();
  });

  test("enforces roles: purchasing sees read-only, sales is blocked", async ({ page }) => {
    const { purchaseOrderId } = await seedIssuedPurchaseOrder(page);

    // Create a draft receipt via API as warehouse
    await signInRequest(page.request, "", SEED_USERS.warehouse);
    const poRes = await page.request.get(`/api/purchase-orders/${purchaseOrderId}`);
    const po = (await poRes.json()) as { lines: { id: string }[] };
    const grRes = await page.request.post("/api/goods-receipts", {
      headers: { origin: WEB_ORIGIN },
      data: {
        purchaseOrderId,
        documentDate: "2026-11-20",
        supplierInvoiceNumber: "F-001",
        controlNumber: "C-001",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]?.id,
            quantity: "50",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
        ],
      },
    });
    expect(grRes.status()).toBe(201);
    const gr = (await grRes.json()) as { id: string };
    await page.context().clearCookies();

    // Purchasing sees list & detail read-only
    await signIn(page, SEED_USERS.purchasing);
    await page.goto("/recepciones-de-mercancia");
    await expect(page.getByRole("link", { name: "Recepciones de mercancía" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Nueva recepción" })).toBeHidden();

    await page.goto(`/recepciones-de-mercancia/${gr.id}`);
    await expect(page.getByRole("link", { name: "Volver" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar borrador" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Emitir" })).toBeHidden();

    // Sales has no access
    await page.context().clearCookies();
    await signIn(page, SEED_USERS.sales);
    await page.goto("/recepciones-de-mercancia");
    await expect(page.getByRole("link", { name: "Recepciones de mercancía" })).toBeHidden();
    await expect(page.getByRole("alert")).toContainText(
      "Solo un administrador, compras o almacén puede ver recepciones de mercancía.",
    );
  });
});
