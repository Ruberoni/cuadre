import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createExchangeRatesModule } from "../../exchange-rates/index.ts";
import { createDrizzlePurchaseOrderRepository } from "../infrastructure/drizzle-purchase-order-repository.ts";
import { purchaseOrdersTable } from "../infrastructure/purchase-orders.table.ts";
import { issuePurchaseOrderUseCase } from "./issue-purchase-order.ts";
import type { PurchasingLookups } from "./purchase-order-repository.ts";

const { db, close } = createDb(testDatabaseUrl());
const TODAY = "2026-11-24";

beforeEach(() => resetDatabase(db));
afterAll(close);

async function createSupplier(
  testApp: ReturnType<typeof createTestApp>,
  headers: Record<string, string>,
  overrides: { rif?: string; name?: string } = {},
) {
  const response = await testApp.app.request("/api/suppliers", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      rif: overrides.rif ?? "J-30123456-1",
      name: overrides.name ?? "Distribuidora Andina, C.A.",
    }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; rif: string; name: string };
}

async function createProduct(
  testApp: ReturnType<typeof createTestApp>,
  headers: Record<string, string>,
  body: {
    sku: string;
    name: string;
    unitOfMeasure: "UNIT" | "BOX" | "BULK" | "KILOGRAM" | "LITER";
    salePrice: { minorUnits: number; currency: "USD" };
    taxRate: "GENERAL" | "REDUCED" | "EXEMPT";
  },
) {
  const response = await testApp.app.request("/api/products", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; sku: string };
}

async function recordExchangeRate(
  testApp: ReturnType<typeof createTestApp>,
  headers: Record<string, string>,
  date: string,
  rate: string,
) {
  const response = await testApp.app.request("/api/exchange-rates", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ date, rate }),
  });
  expect(response.status).toBe(201);
}

describe("purchasing API (draft purchase orders)", () => {
  it("creates, edits, lists and deletes a USD draft with mixed IVA (AC #1, #2)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const purchasing = await signIn(db, testApp, "purchasing");

    const supplier = await createSupplier(testApp, admin);
    const harina = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina de maíz precocida 1 kg",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    const aceite = await createProduct(testApp, admin, {
      sku: "ACE-GIR-1L",
      name: "Aceite de girasol 1 L",
      unitOfMeasure: "UNIT",
      salePrice: { minorUnits: 320, currency: "USD" },
      taxRate: "GENERAL",
    });

    // AC #1: Create USD draft dated today
    const createdRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...purchasing, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [
          { productId: harina.id, quantity: "100", unitCost: { minorUnits: 110, currency: "USD" } },
          { productId: aceite.id, quantity: "50", unitCost: { minorUnits: 200, currency: "USD" } },
        ],
      }),
    });
    expect(createdRes.status).toBe(201);
    const created = (await createdRes.json()) as {
      id: string;
      status: string;
      totals: {
        subtotal: { minorUnits: number };
        ivaByRate: { general: { minorUnits: number } };
        total: { minorUnits: number };
      };
    };
    expect(created.status).toBe("DRAFT");
    expect(created.totals.subtotal.minorUnits).toBe(21000);
    expect(created.totals.ivaByRate.general.minorUnits).toBe(1600);
    expect(created.totals.total.minorUnits).toBe(22600);

    // AC #2: Edit draft — change quantity and remove second line
    const updatedRes = await testApp.app.request(`/api/purchase-orders/${created.id}`, {
      method: "PUT",
      headers: { ...purchasing, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [
          { productId: harina.id, quantity: "120", unitCost: { minorUnits: 110, currency: "USD" } },
        ],
      }),
    });
    expect(updatedRes.status).toBe(200);
    const updated = (await updatedRes.json()) as {
      lines: unknown[];
      totals: { subtotal: { minorUnits: number }; total: { minorUnits: number } };
    };
    expect(updated.lines).toHaveLength(1);
    expect(updated.totals.subtotal.minorUnits).toBe(13200);
    expect(updated.totals.total.minorUnits).toBe(13200);

    // AC #2: Delete draft — disappears from list and GET returns 404
    const deleteRes = await testApp.app.request(`/api/purchase-orders/${created.id}`, {
      method: "DELETE",
      headers: purchasing,
    });
    expect(deleteRes.status).toBe(204);

    const listRes = await testApp.app.request("/api/purchase-orders", { headers: purchasing });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { items: unknown[]; total: number };
    expect(list.total).toBe(0);
    expect(list.items).toEqual([]);

    const getRes = await testApp.app.request(`/api/purchase-orders/${created.id}`, {
      headers: purchasing,
    });
    expect(getRes.status).toBe(404);
  });

  it("computes IVA on taxable base per rate (AC #3: three $0.03 16% lines -> $0.01 IVA)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const supplier = await createSupplier(testApp, admin);
    const item = await createProduct(testApp, admin, {
      sku: "ITEM-16",
      name: "Artículo gravado 16%",
      unitOfMeasure: "UNIT",
      salePrice: { minorUnits: 10, currency: "USD" },
      taxRate: "GENERAL",
    });

    const res = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [
          { productId: item.id, quantity: "1", unitCost: { minorUnits: 3, currency: "USD" } },
          { productId: item.id, quantity: "1", unitCost: { minorUnits: 3, currency: "USD" } },
          { productId: item.id, quantity: "1", unitCost: { minorUnits: 3, currency: "USD" } },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      totals: {
        subtotal: { minorUnits: number };
        ivaByRate: { general: { minorUnits: number } };
        total: { minorUnits: number };
      };
    };
    expect(body.totals.subtotal.minorUnits).toBe(9);
    expect(body.totals.ivaByRate.general.minorUnits).toBe(1);
    expect(body.totals.total.minorUnits).toBe(10);
  });

  it("enforces unit-of-measure quantity precision, past/future DocumentDate, VES currency and empty lines (AC #4, #5, #6, #8)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const supplier = await createSupplier(testApp, admin);
    const bulkProduct = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    const kgProduct = await createProduct(testApp, admin, {
      sku: "POL-FRE-KG",
      name: "Pollo fresco",
      unitOfMeasure: "KILOGRAM",
      salePrice: { minorUnits: 410, currency: "USD" },
      taxRate: "EXEMPT",
    });

    // 2.5 Bulto -> QUANTITY_NOT_WHOLE
    const notWholeRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [
          {
            productId: bulkProduct.id,
            quantity: "2.5",
            unitCost: { minorUnits: 100, currency: "USD" },
          },
        ],
      }),
    });
    expect(notWholeRes.status).toBe(400);
    expect(await notWholeRes.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "lines.0.quantity", code: "QUANTITY_NOT_WHOLE" }],
    });

    // 12.3456 Kilogramo -> QUANTITY_TOO_PRECISE
    const tooPreciseRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [
          {
            productId: kgProduct.id,
            quantity: "12.3456",
            unitCost: { minorUnits: 410, currency: "USD" },
          },
        ],
      }),
    });
    expect(tooPreciseRes.status).toBe(400);
    expect(await tooPreciseRes.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "lines.0.quantity", code: "QUANTITY_TOO_PRECISE" }],
    });

    // 12.345 Kilogramo in VES with past DocumentDate -> 201
    const vesRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "VES",
        documentDate: "2026-11-20",
        lines: [
          {
            productId: kgProduct.id,
            quantity: "12.345",
            unitCost: { minorUnits: 1000, currency: "VES" },
          },
        ],
      }),
    });
    expect(vesRes.status).toBe(201);
    const vesBody = (await vesRes.json()) as {
      currency: string;
      lines: { quantity: string; unitCost: { currency: string } }[];
      totals: { total: { currency: string; minorUnits: number } };
    };
    expect(vesBody.currency).toBe("VES");
    expect(vesBody.lines[0]?.quantity).toBe("12.345");
    expect(vesBody.lines[0]?.unitCost.currency).toBe("VES");
    expect(vesBody.totals.total).toEqual({ minorUnits: 12345, currency: "VES" });

    // Tomorrow -> DOCUMENT_DATE_IN_FUTURE
    const futureRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: "2026-11-25",
        lines: [],
      }),
    });
    expect(futureRes.status).toBe(400);
    expect(await futureRes.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }],
    });

    // Draft with no lines -> 201
    const emptyRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [],
      }),
    });
    expect(emptyRes.status).toBe(201);
  });

  it("refuses editing or deleting a non-draft purchase order with 409 DOCUMENT_NOT_DRAFT (ADR-013)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const supplier = await createSupplier(testApp, admin);

    const createdRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [],
      }),
    });
    const created = (await createdRes.json()) as { id: string };

    // Simulate an issued order in the DB to verify defensive guard.
    await db
      .update(purchaseOrdersTable)
      .set({ status: "ISSUED", frozenRate: "36.51230000" })
      .where(eq(purchaseOrdersTable.id, created.id));

    const editRes = await testApp.app.request(`/api/purchase-orders/${created.id}`, {
      method: "PUT",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [],
      }),
    });
    expect(editRes.status).toBe(409);
    expect(await editRes.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });

    const delRes = await testApp.app.request(`/api/purchase-orders/${created.id}`, {
      method: "DELETE",
      headers: admin,
    });
    expect(delRes.status).toBe(409);
    expect(await delRes.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });
  });

  it("enforces the role matrix on every route (AC #7, REVIEW item 6)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const sessions = await signInAll(db, testApp);
    const supplier = await createSupplier(testApp, sessions.admin);

    const createdRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...sessions.purchasing, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [],
      }),
    });
    const created = (await createdRes.json()) as { id: string };
    const missingId = "99999999-9999-4999-8999-999999999999";

    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/purchase-orders" },
      ["admin", "purchasing", "warehouse"],
      200,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: `/api/purchase-orders/${created.id}` },
      ["admin", "purchasing", "warehouse"],
      200,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      {
        method: "POST",
        path: "/api/purchase-orders",
        body: { supplierId: supplier.id, currency: "USD", documentDate: TODAY, lines: [] },
      },
      ["admin", "purchasing"],
      201,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      {
        method: "PUT",
        path: `/api/purchase-orders/${missingId}`,
        body: { supplierId: supplier.id, currency: "USD", documentDate: TODAY, lines: [] },
      },
      ["admin", "purchasing"],
      404,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "DELETE", path: `/api/purchase-orders/${missingId}` },
      ["admin", "purchasing"],
      404,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "POST", path: `/api/purchase-orders/${missingId}/issue` },
      ["admin", "purchasing"],
      404,
    );
  });
});

describe("purchasing API (issue purchase order)", () => {
  it("issues a USD draft, freezes the rate, and computes VES equivalent in get and list (AC #1, #3, #4)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const purchasing = await signIn(db, testApp, "purchasing");

    const supplier = await createSupplier(testApp, admin);
    const harina = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina de maíz precocida 1 kg",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    const aceite = await createProduct(testApp, admin, {
      sku: "ACE-GIR-1L",
      name: "Aceite de girasol 1 L",
      unitOfMeasure: "UNIT",
      salePrice: { minorUnits: 320, currency: "USD" },
      taxRate: "GENERAL",
    });

    await recordExchangeRate(testApp, admin, "2026-11-17", "36.5123");

    const createRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...purchasing, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: "2026-11-17",
        lines: [
          { productId: harina.id, quantity: "100", unitCost: { minorUnits: 110, currency: "USD" } },
          { productId: aceite.id, quantity: "50", unitCost: { minorUnits: 200, currency: "USD" } },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const draft = (await createRes.json()) as {
      id: string;
      frozenRate: string | null;
      vesTotalEquivalent: unknown;
    };
    expect(draft.frozenRate).toBeNull();
    expect(draft.vesTotalEquivalent).toBeNull();

    // AC #1: Issue the order
    const issueRes = await testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
      method: "POST",
      headers: purchasing,
    });
    expect(issueRes.status).toBe(200);
    const issued = (await issueRes.json()) as {
      status: string;
      frozenRate: string | null;
      totals: { total: { minorUnits: number; currency: string } };
      vesTotalEquivalent: { minorUnits: number; currency: string } | null;
    };
    expect(issued.status).toBe("ISSUED");
    expect(issued.frozenRate).toBe("36.51230000");
    expect(issued.totals.total).toEqual({ minorUnits: 22600, currency: "USD" });
    expect(issued.vesTotalEquivalent).toEqual({ minorUnits: 825178, currency: "VES" });

    // Rate is frozen
    const patchRateRes = await testApp.app.request("/api/exchange-rates/2026-11-17", {
      method: "PATCH",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ rate: "36.9" }),
    });
    expect(patchRateRes.status).toBe(409);
    expect(await patchRateRes.json()).toEqual({
      code: "RATE_ALREADY_FROZEN",
      date: "2026-11-17",
    });

    // AC #3: Recording a later rate does not alter the issued order's frozen rate
    await recordExchangeRate(testApp, admin, "2026-11-20", "37.25");

    const getRes = await testApp.app.request(`/api/purchase-orders/${draft.id}`, {
      headers: purchasing,
    });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as typeof issued;
    expect(fetched.status).toBe("ISSUED");
    expect(fetched.frozenRate).toBe("36.51230000");
    expect(fetched.vesTotalEquivalent).toEqual({ minorUnits: 825178, currency: "VES" });

    const listRes = await testApp.app.request("/api/purchase-orders", { headers: purchasing });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as {
      items: {
        id: string;
        status: string;
        frozenRate: string | null;
        vesTotalEquivalent: { minorUnits: number; currency: string } | null;
      }[];
    };
    expect(list.items[0]).toMatchObject({
      id: draft.id,
      status: "ISSUED",
      frozenRate: "36.51230000",
      vesTotalEquivalent: { minorUnits: 825178, currency: "VES" },
    });

    // AC #4: Edit, delete, and re-issue all return 409 DOCUMENT_NOT_DRAFT
    const putRes = await testApp.app.request(`/api/purchase-orders/${draft.id}`, {
      method: "PUT",
      headers: { ...purchasing, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: "2026-11-17",
        lines: [],
      }),
    });
    expect(putRes.status).toBe(409);
    expect(await putRes.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });

    const delRes = await testApp.app.request(`/api/purchase-orders/${draft.id}`, {
      method: "DELETE",
      headers: purchasing,
    });
    expect(delRes.status).toBe(409);
    expect(await delRes.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });

    const reissueRes = await testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
      method: "POST",
      headers: purchasing,
    });
    expect(reissueRes.status).toBe(409);
    expect(await reissueRes.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });
  });

  it("checks exchange rate date boundaries on issue (AC #2: missing, strictly later fails, strictly earlier succeeds)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const supplier = await createSupplier(testApp, admin);
    const product = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });

    const createRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: "2026-11-17",
        lines: [
          { productId: product.id, quantity: "10", unitCost: { minorUnits: 100, currency: "USD" } },
        ],
      }),
    });
    const draft = (await createRes.json()) as { id: string };

    // No rates at all -> 409 MISSING_EXCHANGE_RATE
    const missing1 = await testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(missing1.status).toBe(409);
    expect(await missing1.json()).toEqual({ code: "MISSING_EXCHANGE_RATE", date: "2026-11-17" });

    // Strictly later rate only -> still 409 MISSING_EXCHANGE_RATE
    await recordExchangeRate(testApp, admin, "2026-11-18", "36.6");
    const missing2 = await testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(missing2.status).toBe(409);
    expect(await missing2.json()).toEqual({ code: "MISSING_EXCHANGE_RATE", date: "2026-11-17" });

    // Order stays DRAFT
    const stillDraft = (await (
      await testApp.app.request(`/api/purchase-orders/${draft.id}`, { headers: admin })
    ).json()) as { status: string; frozenRate: string | null };
    expect(stillDraft.status).toBe("DRAFT");
    expect(stillDraft.frozenRate).toBeNull();

    // Strictly earlier rate -> succeeds and freezes 2026-11-14 (leaving 2026-11-18 unfrozen)
    await recordExchangeRate(testApp, admin, "2026-11-14", "36.4");
    const okRes = await testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(okRes.status).toBe(200);
    const issued = (await okRes.json()) as { status: string; frozenRate: string };
    expect(issued.status).toBe("ISSUED");
    expect(issued.frozenRate).toBe("36.40000000");

    const laterPatch = await testApp.app.request("/api/exchange-rates/2026-11-18", {
      method: "PATCH",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ rate: "36.65" }),
    });
    expect(laterPatch.status).toBe(200);
  });

  it("rejects issuing a 0-line draft with 409 EMPTY_DOCUMENT and a future-dated draft with 400 VALIDATION_ERROR (AC #5)", async () => {
    let today = "2026-11-25";
    const testApp = createTestApp(db, { today: () => today });
    const admin = await signIn(db, testApp, "admin");
    const supplier = await createSupplier(testApp, admin);
    const product = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    await recordExchangeRate(testApp, admin, "2026-11-24", "36.5");

    // 0-line draft -> 409 EMPTY_DOCUMENT
    const emptyDraft = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "USD",
          documentDate: "2026-11-24",
          lines: [],
        }),
      })
    ).json()) as { id: string };

    const emptyIssueRes = await testApp.app.request(`/api/purchase-orders/${emptyDraft.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(emptyIssueRes.status).toBe(409);
    expect(await emptyIssueRes.json()).toEqual({ code: "EMPTY_DOCUMENT" });

    // Draft created on 2026-11-25 then issued when clock is 2026-11-24 -> 400 DOCUMENT_DATE_IN_FUTURE
    const futureDraft = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "USD",
          documentDate: "2026-11-25",
          lines: [
            {
              productId: product.id,
              quantity: "5",
              unitCost: { minorUnits: 100, currency: "USD" },
            },
          ],
        }),
      })
    ).json()) as { id: string };

    today = "2026-11-24";
    const futureIssueRes = await testApp.app.request(
      `/api/purchase-orders/${futureDraft.id}/issue`,
      { method: "POST", headers: admin },
    );
    expect(futureIssueRes.status).toBe(400);
    expect(await futureIssueRes.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }],
    });
  });

  it("allows only one of two concurrent issue requests to succeed (AC #6)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const purchasing = await signIn(db, testApp, "purchasing");
    const supplier = await createSupplier(testApp, admin);
    const product = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    await recordExchangeRate(testApp, admin, TODAY, "36.5123");

    const draft = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...purchasing, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "USD",
          documentDate: TODAY,
          lines: [
            {
              productId: product.id,
              quantity: "10",
              unitCost: { minorUnits: 100, currency: "USD" },
            },
          ],
        }),
      })
    ).json()) as { id: string };

    const [resA, resB] = await Promise.all([
      testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
        method: "POST",
        headers: purchasing,
      }),
      testApp.app.request(`/api/purchase-orders/${draft.id}/issue`, {
        method: "POST",
        headers: admin,
      }),
    ]);

    const sorted = [resA, resB].sort((a, b) => a.status - b.status);
    expect(sorted[0]?.status).toBe(200);
    expect(sorted[1]?.status).toBe(409);
    expect(await sorted[1]?.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });
  });

  it("freezes the rate for VES orders with vesTotalEquivalent: null, and lets both admin and purchasing issue", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const purchasing = await signIn(db, testApp, "purchasing");
    const supplier = await createSupplier(testApp, admin);
    const product = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    await recordExchangeRate(testApp, admin, TODAY, "36.5123");

    const vesDraft = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "VES",
          documentDate: TODAY,
          lines: [
            {
              productId: product.id,
              quantity: "10",
              unitCost: { minorUnits: 5000, currency: "VES" },
            },
          ],
        }),
      })
    ).json()) as { id: string };

    const vesIssueRes = await testApp.app.request(`/api/purchase-orders/${vesDraft.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(vesIssueRes.status).toBe(200);
    const vesIssued = (await vesIssueRes.json()) as {
      status: string;
      frozenRate: string | null;
      vesTotalEquivalent: unknown;
    };
    expect(vesIssued.status).toBe("ISSUED");
    expect(vesIssued.frozenRate).toBe("36.51230000");
    expect(vesIssued.vesTotalEquivalent).toBeNull();

    const usdDraft = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...purchasing, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "USD",
          documentDate: TODAY,
          lines: [
            {
              productId: product.id,
              quantity: "10",
              unitCost: { minorUnits: 100, currency: "USD" },
            },
          ],
        }),
      })
    ).json()) as { id: string };

    const usdIssueRes = await testApp.app.request(`/api/purchase-orders/${usdDraft.id}/issue`, {
      method: "POST",
      headers: purchasing,
    });
    expect(usdIssueRes.status).toBe(200);
  });

  it("rolls back exchange-rate freeze when persisting the issued order fails (ADR-008)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const supplier = await createSupplier(testApp, admin);
    const product = await createProduct(testApp, admin, {
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 145, currency: "USD" },
      taxRate: "EXEMPT",
    });
    await recordExchangeRate(testApp, admin, "2026-11-17", "36.5123");

    const draft = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "USD",
          documentDate: "2026-11-17",
          lines: [
            {
              productId: product.id,
              quantity: "10",
              unitCost: { minorUnits: 100, currency: "USD" },
            },
          ],
        }),
      })
    ).json()) as { id: string };

    const realRepo = createDrizzlePurchaseOrderRepository(db);
    const failingRepo = {
      ...realRepo,
      markIssued: async () => {
        throw new Error("simulated persistence failure");
      },
    };
    const exchangeRates = createExchangeRatesModule({ db, today: () => TODAY });
    const dummyLookups: PurchasingLookups = {
      findSupplierById: async () => null,
      findSuppliersByIds: async () => new Map(),
      findProductsByIds: async () => new Map(),
    };

    await expect(
      issuePurchaseOrderUseCase(
        { db, repository: failingRepo, lookups: dummyLookups, exchangeRates },
        draft.id,
        TODAY as never,
      ),
    ).rejects.toThrow("simulated persistence failure");

    const rateAfter = await exchangeRates.lookupForDate("2026-11-17");
    expect(rateAfter.ok && rateAfter.value.frozen).toBe(false);

    const poAfter = await realRepo.findById(draft.id);
    expect(poAfter?.status).toBe("DRAFT");
    expect(poAfter?.frozenRate).toBeNull();
  });
});
