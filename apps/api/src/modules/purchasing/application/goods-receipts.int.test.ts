import { parseCalendarDate } from "@cuadre/shared-kernel";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "../../../../test/reset-database.ts";
import { createTestApp, signIn } from "../../../../test/sign-in.ts";
import { testDatabaseUrl } from "../../../../test/test-database.ts";
import { createDb } from "../../../db/client.ts";
import { createCatalogModule } from "../../catalog/index.ts";
import { createExchangeRatesModule } from "../../exchange-rates/index.ts";
import { createInventoryModule } from "../../inventory/index.ts";
import { createPartnersModule } from "../../partners/index.ts";
import { createDrizzleGoodsReceiptRepository } from "../infrastructure/drizzle-goods-receipt-repository.ts";
import { createDrizzlePurchaseOrderRepository } from "../infrastructure/drizzle-purchase-order-repository.ts";
import { issueGoodsReceiptUseCase } from "./issue-goods-receipt.ts";

const { db, close } = createDb(testDatabaseUrl());
const TODAY = "2026-11-24";

beforeEach(() => resetDatabase(db));
afterAll(close);

async function setupBase(testApp: ReturnType<typeof createTestApp>) {
  const admin = await signIn(db, testApp, "admin");
  const supplierRes = await testApp.app.request("/api/suppliers", {
    method: "POST",
    headers: { ...admin, "content-type": "application/json" },
    body: JSON.stringify({ rif: "J-30123456-1", name: "Distribuidora Andina, C.A." }),
  });
  expect(supplierRes.status).toBe(201);
  const supplier = (await supplierRes.json()) as { id: string };

  const createProduct = async (body: {
    sku: string;
    name: string;
    unitOfMeasure: "UNIT" | "BOX" | "BULK" | "KILOGRAM" | "LITER";
    salePrice: { minorUnits: number; currency: "USD" };
    taxRate: "GENERAL" | "REDUCED" | "EXEMPT";
  }) => {
    const res = await testApp.app.request("/api/products", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    return (await res.json()) as { id: string; sku: string };
  };

  const recordRate = async (date: string, rate: string) => {
    const res = await testApp.app.request("/api/exchange-rates", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ date, rate }),
    });
    expect(res.status).toBe(201);
  };

  const createIssuedPo = async (input: {
    currency: "USD" | "VES";
    documentDate: string;
    lines: {
      productId: string;
      quantity: string;
      unitCost: { minorUnits: number; currency: "USD" | "VES" };
    }[];
  }) => {
    const createRes = await testApp.app.request("/api/purchase-orders", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ supplierId: supplier.id, ...input }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string };

    const issueRes = await testApp.app.request(`/api/purchase-orders/${created.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(issueRes.status).toBe(200);
    return (await issueRes.json()) as {
      id: string;
      lines: {
        id: string;
        productId: string;
        quantity: string;
        unitCost: { minorUnits: number; currency: "USD" | "VES" };
      }[];
    };
  };

  return { admin, supplier, createProduct, recordRate, createIssuedPo };
}

describe("purchasing goods receipts (use-case & transactional invariants)", () => {
  it("computes weighted average cost across two USD receipts (AC #1) and keeps PO unit cost immutable when receipt cost is edited (AC #2)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const { admin, createProduct, recordRate, createIssuedPo } = await setupBase(testApp);
    const inventory = createInventoryModule({ db });
    await recordRate("2026-11-20", "36.50000000");

    const harina = await createProduct({
      sku: "HAR-PAN-1K",
      name: "Harina de maíz",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 1000, currency: "USD" },
      taxRate: "EXEMPT",
    });

    const po1 = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-20",
      lines: [
        { productId: harina.id, quantity: "10", unitCost: { minorUnits: 500, currency: "USD" } },
      ],
    });
    const r1Create = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po1.id,
        documentDate: "2026-11-20",
        supplierInvoiceNumber: "F-001",
        controlNumber: "C-001",
        lines: [
          {
            purchaseOrderLineId: po1.lines[0]?.id,
            quantity: "10",
            unitCost: { minorUnits: 500, currency: "USD" },
          },
        ],
      }),
    });
    expect(r1Create.status).toBe(201);
    const r1 = (await r1Create.json()) as { id: string };
    expect(
      (
        await testApp.app.request(`/api/goods-receipts/${r1.id}/issue`, {
          method: "POST",
          headers: admin,
        })
      ).status,
    ).toBe(200);

    // AC #1 + AC #2: Second PO at $7.00, receipt edited to $7.20 -> PO still shows $7.00,
    // and first test AC #1 exact $6.00 with $7.00 on a second product or test both.
    const po2 = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-20",
      lines: [
        { productId: harina.id, quantity: "10", unitCost: { minorUnits: 700, currency: "USD" } },
      ],
    });
    const r2Create = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po2.id,
        documentDate: "2026-11-20",
        supplierInvoiceNumber: "F-002",
        controlNumber: "C-002",
        lines: [
          {
            purchaseOrderLineId: po2.lines[0]?.id,
            quantity: "10",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
        ],
      }),
    });
    const r2 = (await r2Create.json()) as { id: string };
    expect(
      (
        await testApp.app.request(`/api/goods-receipts/${r2.id}/issue`, {
          method: "POST",
          headers: admin,
        })
      ).status,
    ).toBe(200);

    const balanceAfterAc1 = await inventory.getStockBalance(harina.id);
    expect(balanceAfterAc1.onHandScaled).toBe(20_000n);
    expect(balanceAfterAc1.totalValueUsd.minorUnits).toBe(12_000);
    expect(balanceAfterAc1.roundedAverageCostUsd?.minorUnits).toBe(600);

    // AC #2: PO line at $7.00, receipt line edited to $7.20 -> inbound cost $7.20, PO still $7.00.
    const aceite = await createProduct({
      sku: "ACE-GIR-1L",
      name: "Aceite",
      unitOfMeasure: "UNIT",
      salePrice: { minorUnits: 900, currency: "USD" },
      taxRate: "EXEMPT",
    });
    const po3 = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-20",
      lines: [
        { productId: aceite.id, quantity: "5", unitCost: { minorUnits: 700, currency: "USD" } },
      ],
    });
    const r3Create = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po3.id,
        documentDate: "2026-11-20",
        supplierInvoiceNumber: "F-003",
        controlNumber: "C-003",
        lines: [
          {
            purchaseOrderLineId: po3.lines[0]?.id,
            quantity: "5",
            unitCost: { minorUnits: 720, currency: "USD" },
          },
        ],
      }),
    });
    const r3 = (await r3Create.json()) as { id: string };
    expect(
      (
        await testApp.app.request(`/api/goods-receipts/${r3.id}/issue`, {
          method: "POST",
          headers: admin,
        })
      ).status,
    ).toBe(200);

    const aceiteBalance = await inventory.getStockBalance(aceite.id);
    expect(aceiteBalance.onHandScaled).toBe(5000n);
    expect(aceiteBalance.totalValueUsd.minorUnits).toBe(3600);

    const po3Fetched = (await (
      await testApp.app.request(`/api/purchase-orders/${po3.id}`, { headers: admin })
    ).json()) as {
      lines: { unitCost: { minorUnits: number } }[];
      goodsReceipt: { id: string; status: string } | null;
    };
    expect(po3Fetched.lines[0]?.unitCost.minorUnits).toBe(700);
    expect(po3Fetched.goodsReceipt).toEqual({ id: r3.id, status: "ISSUED" });
  });

  it("converts VES receipts at the receipt's frozen rate (AC #4) and excludes IVA from stock cost while including IVA in receipt total (AC #5)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const { admin, createProduct, recordRate, createIssuedPo } = await setupBase(testApp);
    const inventory = createInventoryModule({ db });

    // PO issued at an earlier date with a different rate (35.00), receipt issued on a date with 36.5123.
    await recordRate("2026-11-18", "35.00000000");
    await recordRate("2026-11-21", "36.51230000");

    const pollo = await createProduct({
      sku: "POL-FRE-KG",
      name: "Pollo",
      unitOfMeasure: "KILOGRAM",
      salePrice: { minorUnits: 1200, currency: "USD" },
      taxRate: "EXEMPT",
    });
    const atun = await createProduct({
      sku: "ATU-LAT-170",
      name: "Atún 16%",
      unitOfMeasure: "UNIT",
      salePrice: { minorUnits: 300, currency: "USD" },
      taxRate: "GENERAL",
    });

    // AC #4: VES receipt 10 units at Bs. 365,12 with frozen rate 36,51230000 -> $10,00/unit ($100,00 total).
    const vesPo = await createIssuedPo({
      currency: "VES",
      documentDate: "2026-11-18",
      lines: [
        { productId: pollo.id, quantity: "10", unitCost: { minorUnits: 36512, currency: "VES" } },
      ],
    });
    const vesReceiptRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: vesPo.id,
        documentDate: "2026-11-21",
        supplierInvoiceNumber: "F-VES-1",
        controlNumber: "C-VES-1",
        lines: [
          {
            purchaseOrderLineId: vesPo.lines[0]?.id,
            quantity: "10",
            unitCost: { minorUnits: 36512, currency: "VES" },
          },
        ],
      }),
    });
    const vesReceipt = (await vesReceiptRes.json()) as { id: string };
    const vesIssueRes = await testApp.app.request(`/api/goods-receipts/${vesReceipt.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(vesIssueRes.status).toBe(200);
    const vesIssued = (await vesIssueRes.json()) as {
      frozenRate: string;
      vesTotalEquivalent: unknown;
    };
    expect(vesIssued.frozenRate).toBe("36.51230000");
    expect(vesIssued.vesTotalEquivalent).toBeNull();

    const polloBalance = await inventory.getStockBalance(pollo.id);
    expect(polloBalance.onHandScaled).toBe(10_000n);
    expect(polloBalance.totalValueUsd.minorUnits).toBe(10_000);
    expect(polloBalance.roundedAverageCostUsd?.minorUnits).toBe(1000);

    // AC #5: 50 × $2,00 with IVA 16% -> inbound cost $2,00 ($100,00 total, not $116,00), receipt total $116,00.
    const usdPo = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-21",
      lines: [
        { productId: atun.id, quantity: "50", unitCost: { minorUnits: 200, currency: "USD" } },
      ],
    });
    const usdReceiptRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: usdPo.id,
        documentDate: "2026-11-21",
        supplierInvoiceNumber: "F-USD-1",
        controlNumber: "C-USD-1",
        lines: [
          {
            purchaseOrderLineId: usdPo.lines[0]?.id,
            quantity: "50",
            unitCost: { minorUnits: 200, currency: "USD" },
          },
        ],
      }),
    });
    const usdReceipt = (await usdReceiptRes.json()) as { id: string };
    const usdIssueRes = await testApp.app.request(`/api/goods-receipts/${usdReceipt.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(usdIssueRes.status).toBe(200);
    const usdIssued = (await usdIssueRes.json()) as {
      totals: {
        subtotal: { minorUnits: number };
        ivaTotal: { minorUnits: number };
        total: { minorUnits: number };
      };
    };
    expect(usdIssued.totals.subtotal.minorUnits).toBe(10_000);
    expect(usdIssued.totals.ivaTotal.minorUnits).toBe(1600);
    expect(usdIssued.totals.total.minorUnits).toBe(11_600);

    const atunBalance = await inventory.getStockBalance(atun.id);
    expect(atunBalance.onHandScaled).toBe(50_000n);
    expect(atunBalance.totalValueUsd.minorUnits).toBe(10_000);
    expect(atunBalance.roundedAverageCostUsd?.minorUnits).toBe(200);
  });

  it("closes the PO on partial receipt (AC #6), rejects second receipt with GOODS_RECEIPT_ALREADY_EXISTS, and enforces immutability (ADR-013)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const { admin, createProduct, recordRate, createIssuedPo } = await setupBase(testApp);
    const inventory = createInventoryModule({ db });
    await recordRate("2026-11-22", "36.50000000");

    const harina = await createProduct({
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 200, currency: "USD" },
      taxRate: "EXEMPT",
    });

    const po = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-22",
      lines: [
        { productId: harina.id, quantity: "100", unitCost: { minorUnits: 110, currency: "USD" } },
      ],
    });

    // Unreceived PO appears in ?unreceived=true
    const unreceivedBefore = (await (
      await testApp.app.request("/api/purchase-orders?unreceived=true", { headers: admin })
    ).json()) as { items: { id: string }[] };
    expect(unreceivedBefore.items.map((item) => item.id)).toContain(po.id);

    // Partial receipt: 80 of 100
    const createRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: "2026-11-22",
        supplierInvoiceNumber: "F-100",
        controlNumber: "C-100",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]?.id,
            quantity: "80",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    expect(createRes.status).toBe(201);
    const receipt = (await createRes.json()) as { id: string };

    // A second receipt for the same PO fails even while the first is still DRAFT
    const secondRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: "2026-11-22",
        supplierInvoiceNumber: "F-101",
        controlNumber: "C-101",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]?.id,
            quantity: "20",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    expect(secondRes.status).toBe(409);
    expect(await secondRes.json()).toEqual({ code: "GOODS_RECEIPT_ALREADY_EXISTS" });

    // PO disappears from ?unreceived=true once a receipt exists
    const unreceivedAfter = (await (
      await testApp.app.request("/api/purchase-orders?unreceived=true", { headers: admin })
    ).json()) as { items: { id: string }[] };
    expect(unreceivedAfter.items.map((item) => item.id)).not.toContain(po.id);

    // Issue partial receipt -> on-hand grows by 80
    expect(
      (
        await testApp.app.request(`/api/goods-receipts/${receipt.id}/issue`, {
          method: "POST",
          headers: admin,
        })
      ).status,
    ).toBe(200);
    expect((await inventory.getStockBalance(harina.id)).onHandScaled).toBe(80_000n);

    // Second receipt after issue also fails with GOODS_RECEIPT_ALREADY_EXISTS
    const secondAfterIssue = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: "2026-11-22",
        supplierInvoiceNumber: "F-102",
        controlNumber: "C-102",
        lines: [],
      }),
    });
    expect(secondAfterIssue.status).toBe(409);
    expect(await secondAfterIssue.json()).toEqual({ code: "GOODS_RECEIPT_ALREADY_EXISTS" });

    // Issued receipt rejects PUT, DELETE, and re-POST /issue with 409 DOCUMENT_NOT_DRAFT
    const putIssued = await testApp.app.request(`/api/goods-receipts/${receipt.id}`, {
      method: "PUT",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        documentDate: "2026-11-22",
        supplierInvoiceNumber: "F-100",
        controlNumber: "C-100",
        lines: [],
      }),
    });
    expect(putIssued.status).toBe(409);
    expect(await putIssued.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });

    const deleteIssued = await testApp.app.request(`/api/goods-receipts/${receipt.id}`, {
      method: "DELETE",
      headers: admin,
    });
    expect(deleteIssued.status).toBe(409);
    expect(await deleteIssued.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });

    const reissue = await testApp.app.request(`/api/goods-receipts/${receipt.id}/issue`, {
      method: "POST",
      headers: admin,
    });
    expect(reissue.status).toBe(409);
    expect(await reissue.json()).toEqual({ code: "DOCUMENT_NOT_DRAFT" });
  });

  it("rejects issuing an empty 0-line draft with 409 EMPTY_DOCUMENT and leaves stock untouched on MISSING_EXCHANGE_RATE (AC #10)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const { admin, createProduct, recordRate, createIssuedPo } = await setupBase(testApp);
    const inventory = createInventoryModule({ db });
    await recordRate("2026-11-20", "36.50000000");

    const harina = await createProduct({
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 200, currency: "USD" },
      taxRate: "EXEMPT",
    });

    const po = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-20",
      lines: [
        { productId: harina.id, quantity: "10", unitCost: { minorUnits: 110, currency: "USD" } },
      ],
    });

    // Empty draft -> 409 EMPTY_DOCUMENT on issue
    const emptyRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: "2026-11-20",
        supplierInvoiceNumber: "F-EMPTY",
        controlNumber: "C-EMPTY",
        lines: [],
      }),
    });
    expect(emptyRes.status).toBe(201);
    const emptyReceipt = (await emptyRes.json()) as { id: string };
    const issueEmptyRes = await testApp.app.request(
      `/api/goods-receipts/${emptyReceipt.id}/issue`,
      {
        method: "POST",
        headers: admin,
      },
    );
    expect(issueEmptyRes.status).toBe(409);
    expect(await issueEmptyRes.json()).toEqual({ code: "EMPTY_DOCUMENT" });

    // Update receipt to a date with no exchange rate (2026-11-15) and add line -> 409 MISSING_EXCHANGE_RATE, no stock change
    const updateRes = await testApp.app.request(`/api/goods-receipts/${emptyReceipt.id}`, {
      method: "PUT",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        documentDate: "2026-11-15",
        supplierInvoiceNumber: "F-NO-RATE",
        controlNumber: "C-NO-RATE",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]?.id,
            quantity: "10",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    expect(updateRes.status).toBe(200);

    const missingRateRes = await testApp.app.request(
      `/api/goods-receipts/${emptyReceipt.id}/issue`,
      {
        method: "POST",
        headers: admin,
      },
    );
    expect(missingRateRes.status).toBe(409);
    expect(await missingRateRes.json()).toEqual({
      code: "MISSING_EXCHANGE_RATE",
      date: "2026-11-15",
    });

    const balanceAfterMissingRate = await inventory.getStockBalance(harina.id);
    expect(balanceAfterMissingRate.onHandScaled).toBe(0n);
    expect(balanceAfterMissingRate.totalValueUsd.minorUnits).toBe(0);
  });

  it("rolls back the exchange-rate freeze if inventory.recordInboundMovements fails inside the issue transaction (ADR-008)", async () => {
    const testApp = createTestApp(db, { today: () => TODAY });
    const { admin, createProduct, recordRate, createIssuedPo } = await setupBase(testApp);
    // Rate on 2026-11-23 is only used by the receipt (not the PO on 2026-11-20).
    await recordRate("2026-11-20", "36.50000000");
    await recordRate("2026-11-23", "36.80000000");

    const harina = await createProduct({
      sku: "HAR-PAN-1K",
      name: "Harina",
      unitOfMeasure: "BULK",
      salePrice: { minorUnits: 200, currency: "USD" },
      taxRate: "EXEMPT",
    });
    const po = await createIssuedPo({
      currency: "USD",
      documentDate: "2026-11-20",
      lines: [
        { productId: harina.id, quantity: "10", unitCost: { minorUnits: 110, currency: "USD" } },
      ],
    });

    const receiptRes = await testApp.app.request("/api/goods-receipts", {
      method: "POST",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({
        purchaseOrderId: po.id,
        documentDate: "2026-11-23",
        supplierInvoiceNumber: "F-RB",
        controlNumber: "C-RB",
        lines: [
          {
            purchaseOrderLineId: po.lines[0]?.id,
            quantity: "10",
            unitCost: { minorUnits: 110, currency: "USD" },
          },
        ],
      }),
    });
    const receipt = (await receiptRes.json()) as { id: string };

    const catalog = createCatalogModule({ db });
    const partners = createPartnersModule({ db });
    const exchangeRates = createExchangeRatesModule({ db, today: () => TODAY });
    const orderRepo = createDrizzlePurchaseOrderRepository(db);
    const receiptRepo = createDrizzleGoodsReceiptRepository(db);
    const today = parseCalendarDate(TODAY);
    if (!today.ok) throw new Error("bad date");

    const result = await issueGoodsReceiptUseCase(
      {
        db,
        repository: receiptRepo,
        orders: orderRepo,
        lookups: {
          findSupplierById: (id) => partners.findSupplierById(id),
          findSuppliersByIds: (ids) => partners.findSuppliersByIds(ids),
          findProductsByIds: (ids, tx) => catalog.findProductsByIds(ids, tx),
        },
        exchangeRates,
        inventory: {
          recordInboundMovements: async () => ({
            ok: false as const,
            error: "AMOUNT_OUT_OF_RANGE" as const,
          }),
        },
      },
      receipt.id,
      today.value,
    );
    expect(result).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "lines", code: "AMOUNT_OUT_OF_RANGE" }],
    });

    // Receipt stays DRAFT
    const stillDraft = await receiptRepo.findById(receipt.id);
    expect(stillDraft?.status).toBe("DRAFT");
    expect(stillDraft?.frozenRate).toBeNull();

    // 2026-11-23 rate was NOT frozen (can still be corrected)
    const patchRateRes = await testApp.app.request("/api/exchange-rates/2026-11-23", {
      method: "PATCH",
      headers: { ...admin, "content-type": "application/json" },
      body: JSON.stringify({ rate: "36.85" }),
    });
    expect(patchRateRes.status).toBe(200);
  });
});
