import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";

const { db, close } = createDb(testDatabaseUrl());
const TODAY = "2026-11-24";

beforeEach(() => resetDatabase(db));
afterAll(close);

describe("goods-receipts HTTP routes", () => {
  it("enforces the role matrix on every route (PLAN → Roles, REVIEW item 6)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const sessions = await signInAll(db, testApp);

    const supplierRes = await testApp.app.request("/api/suppliers", {
      method: "POST",
      headers: { ...sessions.admin, "content-type": "application/json" },
      body: JSON.stringify({ rif: "J-30123456-1", name: "Distribuidora Andina" }),
    });
    const supplier = (await supplierRes.json()) as { id: string };

    const productRes = await testApp.app.request("/api/products", {
      method: "POST",
      headers: { ...sessions.admin, "content-type": "application/json" },
      body: JSON.stringify({
        sku: "HAR-PAN-1K",
        name: "Harina",
        unitOfMeasure: "BULK",
        salePrice: { minorUnits: 200, currency: "USD" },
        taxRate: "EXEMPT",
      }),
    });
    const product = (await productRes.json()) as { id: string };

    await testApp.app.request("/api/exchange-rates", {
      method: "POST",
      headers: { ...sessions.admin, "content-type": "application/json" },
      body: JSON.stringify({ date: TODAY, rate: "36.5" }),
    });

    const poRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...sessions.admin, "content-type": "application/json" },
      body: JSON.stringify({
        supplierId: supplier.id,
        currency: "USD",
        documentDate: TODAY,
        lines: [
          {
            productId: product.id,
            quantity: "100",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    const po = (await poRes.json()) as { id: string; lines: { id: string }[] };
    await testApp.app.request(`/api/purchase-orders/${po.id}/issue`, {
      method: "POST",
      headers: sessions.admin,
    });

    const createRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...sessions.warehouse, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: TODAY,
        supplierInvoiceNumber: "F-001",
        controlNumber: "C-001",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]!.id,
            quantity: "80",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };
    const missingId = "99999999-9999-4999-8999-999999999999";

    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: "/api/goods-receipts" },
      ["admin", "purchasing", "warehouse"],
      200,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: `/api/goods-receipts/${created.id}` },
      ["admin", "purchasing", "warehouse"],
      200,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      {
        method: "POST",
        path: "/api/goods-receipts",
        body: {
          purchaseOrderId: missingId,
          documentDate: TODAY,
          supplierInvoiceNumber: "F-002",
          controlNumber: "C-002",
          lines: [],
        },
      },
      ["admin", "warehouse"],
      400,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      {
        method: "PUT",
        path: `/api/goods-receipts/${missingId}`,
        body: {
          documentDate: TODAY,
          supplierInvoiceNumber: "F-002",
          controlNumber: "C-002",
          lines: [],
        },
      },
      ["admin", "warehouse"],
      404,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "DELETE", path: `/api/goods-receipts/${missingId}` },
      ["admin", "warehouse"],
      404,
    );
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "POST", path: `/api/goods-receipts/${missingId}/issue` },
      ["admin", "warehouse"],
      404,
    );
  });

  it("rejects draft PO (PURCHASE_ORDER_NOT_ISSUED), quantity > ordered (QUANTITY_EXCEEDS_ORDERED), and missing invoice/control numbers (AC #7, #8, #9)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const admin = await signIn(db, testApp, "admin");
    const warehouse = await signIn(db, testApp, "warehouse");

    const supplier = (await (
      await testApp.app.request("/api/suppliers", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({ rif: "J-30123456-1", name: "Distribuidora Andina" }),
      })
    ).json()) as { id: string };
    const product = (await (
      await testApp.app.request("/api/products", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({
          sku: "HAR-PAN-1K",
          name: "Harina",
          unitOfMeasure: "BULK",
          salePrice: { minorUnits: 200, currency: "USD" },
          taxRate: "EXEMPT",
        }),
      })
    ).json()) as { id: string };
    await testApp.app.request("/api/exchange-rates", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ date: TODAY, rate: "36.5" }),
    });

    // Draft PO -> 409 PURCHASE_ORDER_NOT_ISSUED
    const po = (await (
      await testApp.app.request("/api/purchase-orders", {
        method: "POST",
        headers: { ...admin, "content-type": "application/json" },
        body: JSON.stringify({
          supplierId: supplier.id,
          currency: "USD",
          documentDate: TODAY,
          lines: [
            {
              productId: product.id,
              quantity: "100",
              unitCost: { minorUnits: 110, currency: "USD" },
            },
          ],
        }),
      })
    ).json()) as { id: string; lines: { id: string }[] };

    const draftPoRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...warehouse, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: TODAY,
        supplierInvoiceNumber: "F-001",
        controlNumber: "C-001",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]!.id,
            quantity: "80",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    expect(draftPoRes.status).toBe(409);
    expect(await draftPoRes.json()).toEqual({ code: "PURCHASE_ORDER_NOT_ISSUED" });

    // Issue the PO, then test 120 > 100 and missing invoice/control numbers
    await testApp.app.request(`/api/purchase-orders/${po.id}/issue`, {
      method: "POST",
      headers: admin,
    });

    const invalidRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...warehouse, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: TODAY,
        supplierInvoiceNumber: " ",
        controlNumber: "",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]!.id,
            quantity: "120",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    expect(invalidRes.status).toBe(400);
    expect(await invalidRes.json()).toEqual({
      code: "VALIDATION_ERROR",
      issues: [
        { field: "supplierInvoiceNumber", code: "REQUIRED" },
        { field: "controlNumber", code: "REQUIRED" },
        { field: "lines.0.quantity", code: "QUANTITY_EXCEEDS_ORDERED" },
      ],
    });
  });
});
