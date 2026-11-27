import { type APIRequestContext, expect, test } from "@playwright/test";
import { formatDate, formatMoney, todayCaracas } from "../../src/lib/format/index.ts";
import { SEED_USERS, signIn, signInRequest } from "../support/auth.ts";
import { resetDatabase } from "../support/database.ts";
import { givenExchangeRate } from "../support/exchange-rates.ts";
import { apiUrl } from "../support/products.ts";

async function createProduct(
  request: APIRequestContext,
  input: {
    sku: string;
    name: string;
    unitOfMeasure?: "UNIT" | "BOX" | "BULK" | "KILOGRAM" | "LITER";
  },
): Promise<string> {
  await signInRequest(request, apiUrl);
  const res = await request.post(`${apiUrl}/api/products`, {
    data: {
      sku: input.sku,
      name: input.name,
      unitOfMeasure: input.unitOfMeasure ?? "UNIT",
      salePrice: { minorUnits: 900, currency: "USD" },
      taxRate: "EXEMPT",
    },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

async function createSupplier(request: APIRequestContext): Promise<string> {
  await signInRequest(request, apiUrl);
  const res = await request.post(`${apiUrl}/api/suppliers`, {
    data: { rif: "J-30123456-1", name: "Distribuidora Andina C.A." },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { id: string }).id;
}

async function receiveStock(
  request: APIRequestContext,
  input: {
    supplierId: string;
    productId: string;
    documentDate: string;
    quantity: string;
    unitCostMinor: number;
    supplierInvoiceNumber: string;
    controlNumber: string;
  },
): Promise<string> {
  await signInRequest(request, apiUrl);
  const poRes = await request.post(`${apiUrl}/api/purchase-orders`, {
    data: {
      supplierId: input.supplierId,
      currency: "USD",
      documentDate: input.documentDate,
      lines: [
        {
          productId: input.productId,
          quantity: input.quantity,
          unitCost: { minorUnits: input.unitCostMinor, currency: "USD" },
        },
      ],
    },
  });
  expect(poRes.ok()).toBe(true);
  const po = (await poRes.json()) as { id: string; lines: { id: string }[] };
  const poLineId = po.lines[0]?.id;
  if (poLineId === undefined) throw new Error("missing PO line");

  const issuePo = await request.post(`${apiUrl}/api/purchase-orders/${po.id}/issue`);
  expect(issuePo.ok()).toBe(true);

  const grRes = await request.post(`${apiUrl}/api/goods-receipts`, {
    data: {
      purchaseOrderId: po.id,
      documentDate: input.documentDate,
      supplierInvoiceNumber: input.supplierInvoiceNumber,
      controlNumber: input.controlNumber,
      lines: [
        {
          purchaseOrderLineId: poLineId,
          quantity: input.quantity,
          unitCost: { minorUnits: input.unitCostMinor, currency: "USD" },
        },
      ],
    },
  });
  expect(grRes.ok()).toBe(true);
  const gr = (await grRes.json()) as { id: string };

  const issueGr = await request.post(`${apiUrl}/api/goods-receipts/${gr.id}/issue`);
  expect(issueGr.ok()).toBe(true);
  return gr.id;
}

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await signIn(page);
});

test("10 units at $ 5,00 then 10 at $ 7,00 shows running on-hand 10 → 20 and average $ 5,00 → $ 6,00, each linking to its goods receipt", async ({
  page,
  request,
}) => {
  const today = todayCaracas();
  await givenExchangeRate(request, { date: today, rate: "36.50000000" });
  const supplierId = await createSupplier(request);
  const productId = await createProduct(request, {
    sku: "HAR-PAN-1K",
    name: "Harina de maíz precocida 1 kg",
    unitOfMeasure: "UNIT",
  });

  const firstReceiptId = await receiveStock(request, {
    supplierId,
    productId,
    documentDate: today,
    quantity: "10",
    unitCostMinor: 500,
    supplierInvoiceNumber: "F-00000001",
    controlNumber: "00-00000001",
  });
  const secondReceiptId = await receiveStock(request, {
    supplierId,
    productId,
    documentDate: today,
    quantity: "10",
    unitCostMinor: 700,
    supplierInvoiceNumber: "F-00000002",
    controlNumber: "00-00000002",
  });

  await page.goto("/productos");
  const productRow = page.getByRole("row", { name: /HAR-PAN-1K/ });
  const onHandLink = productRow.getByRole("link", { name: /Ver kardex de HAR-PAN-1K: 20/ });
  await expect(onHandLink).toHaveText("20");
  await onHandLink.click();

  await expect(page).toHaveURL(new RegExp(`/kardex\\?.*producto=${productId}`));
  await expect(page.getByRole("heading", { name: "Kardex" })).toBeVisible();

  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);

  const firstRow = rows.nth(0);
  await expect(firstRow).toContainText(formatDate(today));
  await expect(firstRow).toContainText("10");
  await expect(firstRow).toContainText(formatMoney(500, "USD"));
  const firstLink = firstRow.getByRole("link", { name: "Recepción · F-00000001" });
  await expect(firstLink).toHaveAttribute("href", `/recepciones-de-mercancia/${firstReceiptId}`);

  const secondRow = rows.nth(1);
  await expect(secondRow).toContainText("20");
  await expect(secondRow).toContainText(formatMoney(700, "USD"));
  await expect(secondRow).toContainText(formatMoney(600, "USD"));
  const secondLink = secondRow.getByRole("link", { name: "Recepción · F-00000002" });
  await expect(secondLink).toHaveAttribute("href", `/recepciones-de-mercancia/${secondReceiptId}`);

  await firstLink.click();
  await expect(page).toHaveURL(new RegExp(`/recepciones-de-mercancia/${firstReceiptId}$`));
});

test("a product with no movements shows the kardex empty state", async ({ page, request }) => {
  await createProduct(request, {
    sku: "ACE-GIR-1L",
    name: "Aceite de girasol 1 L",
    unitOfMeasure: "UNIT",
  });

  await page.goto("/kardex");
  await expect(page.getByText("Selecciona un producto para ver su kardex.")).toBeVisible();

  const selector = page.getByRole("combobox", { name: "Producto" });
  await expect(selector).toBeFocused();
  await selector.click();
  await page.getByRole("option", { name: /ACE-GIR-1L/ }).click();

  await expect(page.getByText("Sin movimientos para este producto")).toBeVisible();
  await expect(
    page.getByText("Los movimientos aparecerán al emitir recepciones de mercancía o facturas."),
  ).toBeVisible();
});

test("a sales user sees Existencia in Products as plain text and is refused 403 by the kardex API", async ({
  page,
  request,
}) => {
  const today = todayCaracas();
  await givenExchangeRate(request, { date: today, rate: "36.50000000" });
  const supplierId = await createSupplier(request);
  const productId = await createProduct(request, {
    sku: "HAR-PAN-1K",
    name: "Harina de maíz precocida 1 kg",
    unitOfMeasure: "UNIT",
  });
  await receiveStock(request, {
    supplierId,
    productId,
    documentDate: today,
    quantity: "12",
    unitCostMinor: 500,
    supplierInvoiceNumber: "F-00000012",
    controlNumber: "00-00000012",
  });

  await page.context().clearCookies();
  await signIn(page, SEED_USERS.sales);
  await page.goto("/productos");

  const row = page.getByRole("row", { name: /HAR-PAN-1K/ });
  await expect(row).toContainText("12");
  await expect(row.getByRole("link")).toHaveCount(0);

  const nav = page.getByRole("navigation", { name: "Principal" });
  await expect(nav.getByRole("link", { name: "Kardex" })).toHaveCount(0);

  const apiRes = await page.request.get(`${apiUrl}/api/kardex/${productId}`);
  expect(apiRes.status()).toBe(403);
  expect(await apiRes.json()).toEqual({ code: "FORBIDDEN" });

  await page.goto(`/kardex?producto=${productId}`);
  await expect(page.getByRole("alert")).toHaveText(
    "Solo un administrador, compras o almacén puede ver el kardex.",
  );
});

test("150,5 kg on hand of a Kilogramo product shows 150,5 with es-VE formatting in Existencia", async ({
  page,
  request,
}) => {
  const today = todayCaracas();
  await givenExchangeRate(request, { date: today, rate: "36.50000000" });
  const supplierId = await createSupplier(request);
  const productId = await createProduct(request, {
    sku: "POL-FRE-KG",
    name: "Pollo fresco entero",
    unitOfMeasure: "KILOGRAM",
  });
  await receiveStock(request, {
    supplierId,
    productId,
    documentDate: today,
    quantity: "150.5",
    unitCostMinor: 400,
    supplierInvoiceNumber: "F-00000150",
    controlNumber: "00-00000150",
  });

  await page.goto("/productos");
  const row = page.getByRole("row", { name: /POL-FRE-KG/ });
  await expect(row.getByRole("cell").last()).toHaveText("150,5");
});
