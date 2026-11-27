import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { expectAllowedRoles, type Sessions, signInAll } from "../../../../test/roles.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";

const { db, close } = createDb(testDatabaseUrl());
const testApp = createTestApp(db, { today: () => "2026-11-26" });
const { app } = testApp;
let session: Record<string, string> = {};

const get = (path: string) => app.request(path, { headers: session });
const post = (path: string, body?: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { ...session, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

async function givenExchangeRate(date: string, rate = "36.50000000") {
  const res = await post("/api/exchange-rates", { date, rate });
  expect(res.status).toBe(201);
}

async function givenSupplier(): Promise<string> {
  const res = await post("/api/suppliers", {
    rif: "J-30123456-1",
    name: "Distribuidora Andina C.A.",
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function givenProduct(
  overrides: Partial<{
    sku: string;
    name: string;
    unitOfMeasure: "UNIT" | "BOX" | "BULK" | "KILOGRAM" | "LITER";
  }> = {},
): Promise<string> {
  const res = await post("/api/products", {
    sku: overrides.sku ?? "HAR-PAN-1K",
    name: overrides.name ?? "Harina de maíz precocida 1 kg",
    unitOfMeasure: overrides.unitOfMeasure ?? "UNIT",
    salePrice: { minorUnits: 800, currency: "USD" },
    taxRate: "EXEMPT",
  });
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function givenIssuedGoodsReceipt({
  supplierId,
  productId,
  documentDate,
  quantity,
  unitCostMinor,
  supplierInvoiceNumber,
  controlNumber,
}: {
  supplierId: string;
  productId: string;
  documentDate: string;
  quantity: string;
  unitCostMinor: number;
  supplierInvoiceNumber: string;
  controlNumber: string;
}): Promise<string> {
  const poRes = await post("/api/purchase-orders", {
    supplierId,
    currency: "USD",
    documentDate,
    lines: [{ productId, quantity, unitCost: { minorUnits: unitCostMinor, currency: "USD" } }],
  });
  expect(poRes.status).toBe(201);
  const po = (await poRes.json()) as { id: string; lines: { id: string }[] };
  const poLineId = po.lines[0]?.id;
  if (poLineId === undefined) throw new Error("missing PO line");

  const issuePoRes = await post(`/api/purchase-orders/${po.id}/issue`);
  expect(issuePoRes.status).toBe(200);

  const grRes = await post("/api/goods-receipts", {
    purchaseOrderId: po.id,
    documentDate,
    supplierInvoiceNumber,
    controlNumber,
    lines: [
      {
        purchaseOrderLineId: poLineId,
        quantity,
        unitCost: { minorUnits: unitCostMinor, currency: "USD" },
      },
    ],
  });
  expect(grRes.status).toBe(201);
  const gr = (await grRes.json()) as { id: string };

  const issueGrRes = await post(`/api/goods-receipts/${gr.id}/issue`);
  expect(issueGrRes.status).toBe(200);
  return gr.id;
}

beforeEach(async () => {
  await resetDatabase(db);
  session = await signIn(db, testApp);
});
afterAll(close);

describe("GET /api/kardex/:productId", () => {
  it("returns movements in chronological order with running on-hand, average cost, and goods receipt invoice numbers", async () => {
    await givenExchangeRate("2026-11-20");
    const supplierId = await givenSupplier();
    const productId = await givenProduct();

    // Issue the later receipt first to prove ordering is chronological by documentDate, not insert order.
    const secondReceiptId = await givenIssuedGoodsReceipt({
      supplierId,
      productId,
      documentDate: "2026-11-22",
      quantity: "10",
      unitCostMinor: 700,
      supplierInvoiceNumber: "F-00000002",
      controlNumber: "00-00000002",
    });
    const firstReceiptId = await givenIssuedGoodsReceipt({
      supplierId,
      productId,
      documentDate: "2026-11-21",
      quantity: "10",
      unitCostMinor: 500,
      supplierInvoiceNumber: "F-00000001",
      controlNumber: "00-00000001",
    });

    const res = await get(`/api/kardex/${productId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      product: {
        id: productId,
        sku: "HAR-PAN-1K",
        name: "Harina de maíz precocida 1 kg",
        unitOfMeasure: "UNIT",
      },
      onHand: "20",
      averageCost: { minorUnits: 600, currency: "USD" },
      total: 2,
      page: 1,
      pageSize: 50,
      items: [
        {
          id: expect.any(String),
          documentDate: "2026-11-21",
          direction: "INBOUND",
          quantity: "10",
          unitCost: { minorUnits: 500, currency: "USD" },
          averageCostAfter: { minorUnits: 500, currency: "USD" },
          onHandAfter: "10",
          referenceType: "GOODS_RECEIPT",
          referenceId: firstReceiptId,
          referenceNumber: "F-00000001",
        },
        {
          id: expect.any(String),
          documentDate: "2026-11-22",
          direction: "INBOUND",
          quantity: "10",
          unitCost: { minorUnits: 700, currency: "USD" },
          averageCostAfter: { minorUnits: 600, currency: "USD" },
          onHandAfter: "20",
          referenceType: "GOODS_RECEIPT",
          referenceId: secondReceiptId,
          referenceNumber: "F-00000002",
        },
      ],
    });
  });

  it("returns empty ledger, zero on-hand, and null averageCost for a product with no movements", async () => {
    const productId = await givenProduct();

    const res = await get(`/api/kardex/${productId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      product: {
        id: productId,
        sku: "HAR-PAN-1K",
        name: "Harina de maíz precocida 1 kg",
        unitOfMeasure: "UNIT",
      },
      onHand: "0",
      averageCost: null,
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });
  });

  it("formats fractional Kilogramo quantities canonically without trailing zeros (150.5)", async () => {
    await givenExchangeRate("2026-11-20");
    const supplierId = await givenSupplier();
    const productId = await givenProduct({
      sku: "POL-FRE-KG",
      name: "Pollo fresco entero",
      unitOfMeasure: "KILOGRAM",
    });

    await givenIssuedGoodsReceipt({
      supplierId,
      productId,
      documentDate: "2026-11-21",
      quantity: "150.5",
      unitCostMinor: 400,
      supplierInvoiceNumber: "F-00000150",
      controlNumber: "00-00000150",
    });

    const res = await get(`/api/kardex/${productId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      onHand: string;
      items: { quantity: string; onHandAfter: string }[];
    };
    expect(body.onHand).toBe("150.5");
    expect(body.items[0]?.quantity).toBe("150.5");
    expect(body.items[0]?.onHandAfter).toBe("150.5");
  });

  it("slices pagination cleanly and rejects invalid params with 400 or unknown product with 404", async () => {
    const productId = await givenProduct();

    const page2 = await get(`/api/kardex/${productId}?page=2`);
    expect(page2.status).toBe(200);
    expect(await page2.json()).toMatchObject({ items: [], total: 0, page: 2, pageSize: 50 });

    const notFound = await get("/api/kardex/99999999-9999-4999-8999-999999999999");
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({ code: "NOT_FOUND" });

    const badUuid = await get("/api/kardex/not-a-uuid");
    expect(badUuid.status).toBe(400);
    expect(await badUuid.json()).toMatchObject({ code: "VALIDATION_ERROR" });

    const badPage = await get(`/api/kardex/${productId}?page=0`);
    expect(badPage.status).toBe(400);
    expect(await badPage.json()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("documents /api/kardex/{productId} with 200, 403 and 404 in /openapi.json", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    };

    const responses = Object.keys(doc.paths["/api/kardex/{productId}"]?.get?.responses ?? {});
    expect(responses).toEqual(expect.arrayContaining(["200", "403", "404"]));
  });
});

describe("roles (PLAN → Roles: admin, purchasing, warehouse read kardex; sales gets 403)", () => {
  let sessions: Sessions;
  beforeEach(async () => {
    sessions = await signInAll(db, testApp);
  });

  it("GET /api/kardex/:productId allows admin, purchasing and warehouse, and refuses sales with 403", async () => {
    const productId = await givenProduct();
    await expectAllowedRoles(
      testApp,
      sessions,
      { method: "GET", path: `/api/kardex/${productId}` },
      ["admin", "purchasing", "warehouse"],
      200,
    );
  });
});
