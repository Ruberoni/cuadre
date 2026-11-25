import { money, parseCalendarDate, parseQuantity, parseRate } from "@cuadre/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  calculatePurchaseOrderTotals,
  calculatePurchaseOrderVesEquivalent,
  type PurchaseOrderProductRef,
  reconstitutePurchaseOrder,
  type StoredPurchaseOrder,
  validateDraftPurchaseOrder,
  validateIssuePurchaseOrder,
} from "./purchase-order.ts";

const TODAY = mustDate("2026-11-24");
const SUPPLIER_ID = "11111111-1111-4111-8111-111111111111";
const HARINA_ID = "22222222-2222-4222-8222-222222222221";
const ACEITE_ID = "22222222-2222-4222-8222-222222222222";
const POLLO_ID = "22222222-2222-4222-8222-222222222223";

const PRODUCTS = new Map<string, PurchaseOrderProductRef>([
  [
    HARINA_ID,
    {
      id: HARINA_ID,
      sku: "HAR-PAN-1K",
      name: "Harina de maíz precocida 1 kg",
      unitOfMeasure: "BULK",
      taxRate: "EXEMPT",
    },
  ],
  [
    ACEITE_ID,
    {
      id: ACEITE_ID,
      sku: "ACE-GIR-1L",
      name: "Aceite de girasol 1 L",
      unitOfMeasure: "UNIT",
      taxRate: "GENERAL",
    },
  ],
  [
    POLLO_ID,
    {
      id: POLLO_ID,
      sku: "POL-FRE-KG",
      name: "Pollo fresco entero",
      unitOfMeasure: "KILOGRAM",
      taxRate: "EXEMPT",
    },
  ],
]);

function mustDate(raw: string) {
  const result = parseCalendarDate(raw);
  if (!result.ok) throw new Error(`Invalid date: ${raw}`);
  return result.value;
}

describe("validateDraftPurchaseOrder", () => {
  it("validates a USD draft with mixed IVA and computes totals (AC #1)", () => {
    const result = validateDraftPurchaseOrder(
      {
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        lines: [
          { productId: HARINA_ID, quantity: "100", unitCost: { minorUnits: 110, currency: "USD" } },
          { productId: ACEITE_ID, quantity: "50", unitCost: { minorUnits: 200, currency: "USD" } },
        ],
      },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("DRAFT");

    const totals = calculatePurchaseOrderTotals(
      {
        currency: result.value.currency,
        lines: result.value.lines.map((l, i) => ({ id: `line-${i}`, ...l })),
      },
      PRODUCTS,
    );
    expect(totals.subtotal.minorUnits).toBe(21000);
    expect(totals.ivaByRate.general.minorUnits).toBe(1600);
    expect(totals.total.minorUnits).toBe(22600);
  });

  it("allows a draft with no lines (AC #8)", () => {
    const result = validateDraftPurchaseOrder(
      {
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        lines: [],
      },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.lines).toEqual([]);
  });

  it("accepts a past DocumentDate and rejects tomorrow with DOCUMENT_DATE_IN_FUTURE (AC #5)", () => {
    const past = validateDraftPurchaseOrder(
      { supplierId: SUPPLIER_ID, currency: "USD", documentDate: "2026-11-20", lines: [] },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );
    expect(past.ok).toBe(true);

    const future = validateDraftPurchaseOrder(
      { supplierId: SUPPLIER_ID, currency: "USD", documentDate: "2026-11-25", lines: [] },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );
    expect(future).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }],
    });
  });

  it("enforces unit-of-measure quantity rules (AC #4: 2.5 Bulto, 12.345 Kilogramo, 12.3456)", () => {
    const notWhole = validateDraftPurchaseOrder(
      {
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        lines: [
          { productId: HARINA_ID, quantity: "2.5", unitCost: { minorUnits: 110, currency: "USD" } },
        ],
      },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );
    expect(notWhole).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "lines.0.quantity", code: "QUANTITY_NOT_WHOLE" }],
    });

    const threeDecimals = validateDraftPurchaseOrder(
      {
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        lines: [
          {
            productId: POLLO_ID,
            quantity: "12.345",
            unitCost: { minorUnits: 410, currency: "USD" },
          },
        ],
      },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );
    expect(threeDecimals.ok).toBe(true);

    const tooPrecise = validateDraftPurchaseOrder(
      {
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        lines: [
          {
            productId: POLLO_ID,
            quantity: "12.3456",
            unitCost: { minorUnits: 410, currency: "USD" },
          },
        ],
      },
      { supplierExists: true, productsById: PRODUCTS, today: TODAY },
    );
    expect(tooPrecise).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "lines.0.quantity", code: "QUANTITY_TOO_PRECISE" }],
    });
  });

  it("rejects mismatched line currency and missing supplier", () => {
    const result = validateDraftPurchaseOrder(
      {
        supplierId: SUPPLIER_ID,
        currency: "VES",
        documentDate: "2026-11-24",
        lines: [
          { productId: HARINA_ID, quantity: "10", unitCost: { minorUnits: 100, currency: "USD" } },
        ],
      },
      { supplierExists: false, productsById: PRODUCTS, today: TODAY },
    );
    expect(result).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "supplierId", code: "NOT_FOUND" },
        { field: "lines.0.unitCost", code: "CURRENCY_MISMATCH" },
      ],
    });
  });
});

function makeStoredOrder(overrides: Partial<StoredPurchaseOrder> = {}): StoredPurchaseOrder {
  const qty = parseQuantity("100", { allowDecimals: false });
  const cost = money(110, "USD");
  if (!qty.ok || !cost.ok) throw new Error("Test fixture failed");
  return {
    id: "33333333-3333-4333-8333-333333333333",
    supplierId: SUPPLIER_ID,
    currency: "USD",
    documentDate: TODAY,
    status: "DRAFT",
    frozenRate: null,
    lines: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        position: 0,
        productId: HARINA_ID,
        quantity: qty.value,
        unitCost: cost.value,
      },
    ],
    ...overrides,
  };
}

describe("validateIssuePurchaseOrder", () => {
  it("accepts a DRAFT order with lines and documentDate <= today", () => {
    const order = makeStoredOrder();
    expect(validateIssuePurchaseOrder(order, TODAY)).toEqual({ ok: true, value: order });
  });

  it("rejects an empty DRAFT with EMPTY_DOCUMENT", () => {
    const order = makeStoredOrder({ lines: [] });
    expect(validateIssuePurchaseOrder(order, TODAY)).toEqual({
      ok: false,
      error: "EMPTY_DOCUMENT",
    });
  });

  it("rejects a DRAFT with documentDate > today with VALIDATION_ERROR DOCUMENT_DATE_IN_FUTURE", () => {
    const order = makeStoredOrder({ documentDate: mustDate("2026-11-25") });
    expect(validateIssuePurchaseOrder(order, TODAY)).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }],
    });
  });

  it("rejects a non-DRAFT order with DOCUMENT_NOT_DRAFT", () => {
    const rate = parseRate("36.51230000");
    if (!rate.ok) throw new Error("rate failed");
    const order = makeStoredOrder({ status: "ISSUED", frozenRate: rate.value });
    expect(validateIssuePurchaseOrder(order, TODAY)).toEqual({
      ok: false,
      error: "DOCUMENT_NOT_DRAFT",
    });
  });
});

describe("reconstitutePurchaseOrder & calculatePurchaseOrderVesEquivalent", () => {
  it("enforces DRAFT => frozenRate === null and ISSUED => frozenRate !== null", () => {
    expect(
      reconstitutePurchaseOrder({
        id: "33333333-3333-4333-8333-333333333333",
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        status: "DRAFT",
        frozenRate: "36.51230000",
        lines: [],
      }),
    ).toEqual({ ok: false, error: "INVALID_STORED_PURCHASE_ORDER" });

    expect(
      reconstitutePurchaseOrder({
        id: "33333333-3333-4333-8333-333333333333",
        supplierId: SUPPLIER_ID,
        currency: "USD",
        documentDate: "2026-11-24",
        status: "ISSUED",
        frozenRate: null,
        lines: [],
      }),
    ).toEqual({ ok: false, error: "INVALID_STORED_PURCHASE_ORDER" });

    const validIssued = reconstitutePurchaseOrder({
      id: "33333333-3333-4333-8333-333333333333",
      supplierId: SUPPLIER_ID,
      currency: "USD",
      documentDate: "2026-11-17",
      status: "ISSUED",
      frozenRate: "36.51230000",
      lines: [],
    });
    expect(validIssued.ok).toBe(true);
  });

  it("computes VES equivalent for issued USD orders and null for drafts or VES orders", () => {
    const rate = parseRate("36.51230000");
    const totalUsd = money(22600, "USD");
    const totalVes = money(12345, "VES");
    if (!rate.ok || !totalUsd.ok || !totalVes.ok) throw new Error("fixture failed");

    expect(calculatePurchaseOrderVesEquivalent({ frozenRate: null }, totalUsd.value)).toBeNull();
    expect(
      calculatePurchaseOrderVesEquivalent({ frozenRate: rate.value }, totalVes.value),
    ).toBeNull();
    expect(
      calculatePurchaseOrderVesEquivalent({ frozenRate: rate.value }, totalUsd.value)?.minorUnits,
    ).toBe(825178);
  });
});
