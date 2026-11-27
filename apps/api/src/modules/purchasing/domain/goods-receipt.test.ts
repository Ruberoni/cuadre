import {
  type CalendarDate,
  type Currency,
  money,
  parseCalendarDate,
  parseQuantity,
} from "@cuadre/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  type DraftGoodsReceiptInput,
  type StoredGoodsReceipt,
  validateDraftGoodsReceipt,
  validateIssueGoodsReceipt,
} from "./goods-receipt.ts";
import type { PurchaseOrderProductRef, StoredPurchaseOrder } from "./purchase-order.ts";

const ORDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SUPPLIER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const HARINA = "11111111-1111-4111-8111-111111111111";
const POLLO = "22222222-2222-4222-8222-222222222222";
const LINE_1 = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const LINE_2 = "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2";

function date(raw: string): CalendarDate {
  const parsed = parseCalendarDate(raw);
  if (!parsed.ok) throw new Error("bad date");
  return parsed.value;
}
const TODAY = date("2026-11-24");

function qty(raw: string) {
  const parsed = parseQuantity(raw, { allowDecimals: true });
  if (!parsed.ok) throw new Error("bad quantity");
  return parsed.value;
}
function cash(minor: number, currency: Currency = "USD") {
  const parsed = money(minor, currency);
  if (!parsed.ok) throw new Error("bad money");
  return parsed.value;
}

const products = new Map<string, PurchaseOrderProductRef>([
  [HARINA, { id: HARINA, sku: "HAR", name: "Harina", unitOfMeasure: "BULK", taxRate: "EXEMPT" }],
  [POLLO, { id: POLLO, sku: "POL", name: "Pollo", unitOfMeasure: "KILOGRAM", taxRate: "GENERAL" }],
]);

function order(overrides: Partial<StoredPurchaseOrder> = {}): StoredPurchaseOrder {
  return {
    id: ORDER_ID,
    supplierId: SUPPLIER_ID,
    currency: "USD",
    documentDate: date("2026-11-20"),
    status: "ISSUED",
    frozenRate: null,
    lines: [
      { id: LINE_1, position: 0, productId: HARINA, quantity: qty("100"), unitCost: cash(700) },
      { id: LINE_2, position: 1, productId: POLLO, quantity: qty("12.5"), unitCost: cash(410) },
    ],
    ...overrides,
  };
}

function input(overrides: Partial<DraftGoodsReceiptInput> = {}): DraftGoodsReceiptInput {
  return {
    purchaseOrderId: ORDER_ID,
    documentDate: "2026-11-24",
    supplierInvoiceNumber: "F-0001",
    controlNumber: "00-123456",
    lines: [
      {
        purchaseOrderLineId: LINE_1,
        quantity: "80",
        unitCost: { minorUnits: 720, currency: "USD" },
      },
    ],
    ...overrides,
  };
}

function validate(i: DraftGoodsReceiptInput, o = order()) {
  return validateDraftGoodsReceipt(i, { order: o, productsById: products, today: TODAY });
}

describe("validateDraftGoodsReceipt", () => {
  it("accepts a partial receipt with an edited unit cost and leaves out unreceived lines", () => {
    const result = validate(input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.lines).toHaveLength(1);
    expect(result.value.lines[0]?.unitCost).toEqual(cash(720));
    expect(result.value.lines[0]?.quantity.scaled).toBe(80_000n);
    expect(result.value.supplierId).toBe(SUPPLIER_ID);
  });

  it("refuses a draft purchase order", () => {
    expect(validate(input(), order({ status: "DRAFT" }))).toEqual({
      ok: false,
      error: "PURCHASE_ORDER_NOT_ISSUED",
    });
  });

  it("refuses more than the ordered quantity (QUANTITY_EXCEEDS_ORDERED) but allows exactly the ordered one", () => {
    const over = validate(
      input({
        lines: [
          {
            purchaseOrderLineId: LINE_1,
            quantity: "120",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
        ],
      }),
    );
    expect(over).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "lines.0.quantity", code: "QUANTITY_EXCEEDS_ORDERED" }],
    });

    const exact = validate(
      input({
        lines: [
          {
            purchaseOrderLineId: LINE_1,
            quantity: "100",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
        ],
      }),
    );
    expect(exact.ok).toBe(true);
  });

  it("requires the supplier invoice number and the control number, trimmed and within 50 characters", () => {
    expect(validate(input({ supplierInvoiceNumber: "  ", controlNumber: "" }))).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "supplierInvoiceNumber", code: "REQUIRED" },
        { field: "controlNumber", code: "REQUIRED" },
      ],
    });
    expect(validate(input({ controlNumber: "x".repeat(51) }))).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "controlNumber", code: "TOO_LONG" }],
    });
  });

  it("rejects a future date, an unknown or repeated order line, and a unit that does not allow decimals", () => {
    const result = validate(
      input({
        documentDate: "2026-11-25",
        lines: [
          {
            purchaseOrderLineId: LINE_1,
            quantity: "2.5",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
          {
            purchaseOrderLineId: LINE_1,
            quantity: "1",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
          {
            purchaseOrderLineId: ORDER_ID,
            quantity: "1",
            unitCost: { minorUnits: 700, currency: "USD" },
          },
          {
            purchaseOrderLineId: LINE_2,
            quantity: "1.2345",
            unitCost: { minorUnits: 410, currency: "USD" },
          },
        ],
      }),
    );

    expect(result).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" },
        { field: "lines.0.quantity", code: "QUANTITY_NOT_WHOLE" },
        { field: "lines.1.purchaseOrderLineId", code: "DUPLICATE_LINE" },
        { field: "lines.2.purchaseOrderLineId", code: "NOT_FOUND" },
        { field: "lines.3.quantity", code: "QUANTITY_TOO_PRECISE" },
      ],
    });
  });

  it("rejects a unit cost in another currency or not positive", () => {
    const result = validate(
      input({
        lines: [
          {
            purchaseOrderLineId: LINE_1,
            quantity: "1",
            unitCost: { minorUnits: 700, currency: "VES" },
          },
          {
            purchaseOrderLineId: LINE_2,
            quantity: "1",
            unitCost: { minorUnits: 0, currency: "USD" },
          },
        ],
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "lines.0.unitCost", code: "CURRENCY_MISMATCH" },
        { field: "lines.1.unitCost", code: "NOT_POSITIVE" },
      ],
    });
  });

  it("allows a draft with no lines (it cannot be issued, ADR-013)", () => {
    expect(validate(input({ lines: [] })).ok).toBe(true);
  });
});

describe("validateIssueGoodsReceipt", () => {
  function receipt(overrides: Partial<StoredGoodsReceipt> = {}): StoredGoodsReceipt {
    return {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      purchaseOrderId: ORDER_ID,
      supplierId: SUPPLIER_ID,
      currency: "USD",
      documentDate: date("2026-11-24"),
      supplierInvoiceNumber: "F-1",
      controlNumber: "C-1",
      status: "DRAFT",
      frozenRate: null,
      lines: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          position: 0,
          purchaseOrderLineId: LINE_1,
          productId: HARINA,
          quantity: qty("80"),
          unitCost: cash(720),
        },
      ],
      ...overrides,
    };
  }

  it("accepts a draft with lines dated today", () => {
    expect(validateIssueGoodsReceipt(receipt(), order(), TODAY).ok).toBe(true);
  });

  it("refuses an issued receipt, an empty one, and one dated in the future", () => {
    expect(validateIssueGoodsReceipt(receipt({ status: "ISSUED" }), order(), TODAY)).toEqual({
      ok: false,
      error: "DOCUMENT_NOT_DRAFT",
    });
    expect(validateIssueGoodsReceipt(receipt({ lines: [] }), order(), TODAY)).toEqual({
      ok: false,
      error: "EMPTY_DOCUMENT",
    });
    expect(
      validateIssueGoodsReceipt(receipt({ documentDate: date("2026-11-25") }), order(), TODAY),
    ).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }],
    });
  });
});
