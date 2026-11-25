import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { purchaseOrdersTable } from "../infrastructure/purchase-orders.table.ts";

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
      .set({ status: "ISSUED" })
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
  });
});
