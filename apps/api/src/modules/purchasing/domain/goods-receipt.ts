import {
  CONTROL_NUMBER_MAX_LENGTH,
  type DocumentStatus,
  type GoodsReceiptIssueCode,
  SUPPLIER_INVOICE_NUMBER_MAX_LENGTH,
  UNIT_ALLOWS_DECIMALS,
} from "@cuadre/contracts";
import {
  type CalendarDate,
  type Currency,
  compareCalendarDates,
  computeDocumentTotals,
  type DocumentTotals,
  err,
  type FieldIssue,
  type IssuePreconditionFailure,
  invalid,
  type Money,
  money,
  ok,
  parseCalendarDate,
  parseQuantity,
  parseRate,
  type Quantity,
  type Rate,
  type Result,
  type ValidationFailure,
  validateDocumentIssuePreconditions,
} from "@cuadre/shared-kernel";
import {
  calculatePurchaseOrderTotals,
  calculatePurchaseOrderVesEquivalent,
  isUuid,
  type PurchaseOrderProductRef,
  type StoredPurchaseOrder,
} from "./purchase-order.ts";

export type DraftGoodsReceiptLineInput = {
  readonly purchaseOrderLineId: string;
  readonly quantity: string;
  readonly unitCost: { readonly minorUnits: number; readonly currency: Currency };
};

export type DraftGoodsReceiptInput = {
  readonly purchaseOrderId: string;
  readonly documentDate: string;
  readonly supplierInvoiceNumber: string;
  readonly controlNumber: string;
  readonly lines: readonly DraftGoodsReceiptLineInput[];
};

export type ValidatedGoodsReceiptLine = {
  readonly position: number;
  readonly purchaseOrderLineId: string;
  readonly productId: string;
  readonly quantity: Quantity;
  readonly unitCost: Money;
};

export type ValidatedDraftGoodsReceipt = {
  readonly purchaseOrderId: string;
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: CalendarDate;
  readonly supplierInvoiceNumber: string;
  readonly controlNumber: string;
  readonly status: "DRAFT";
  readonly lines: readonly ValidatedGoodsReceiptLine[];
};

export type StoredGoodsReceiptLine = {
  readonly id: string;
  readonly position: number;
  readonly purchaseOrderLineId: string;
  readonly productId: string;
  readonly quantity: Quantity;
  readonly unitCost: Money;
};

export type StoredGoodsReceipt = {
  readonly id: string;
  readonly purchaseOrderId: string;
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: CalendarDate;
  readonly supplierInvoiceNumber: string;
  readonly controlNumber: string;
  readonly status: DocumentStatus;
  readonly frozenRate: Rate | null;
  readonly lines: readonly StoredGoodsReceiptLine[];
};

export type GoodsReceiptValidationFailure = ValidationFailure<string, GoodsReceiptIssueCode>;

export type DraftGoodsReceiptFailure =
  | { readonly ok: false; readonly error: "PURCHASE_ORDER_NOT_ISSUED" }
  | GoodsReceiptValidationFailure;

function checkNumber(
  field: "supplierInvoiceNumber" | "controlNumber",
  raw: string,
  maxLength: number,
  issues: FieldIssue<string, GoodsReceiptIssueCode>[],
): string {
  const value = raw.trim();
  if (value === "") issues.push({ field, code: "REQUIRED" });
  else if (value.length > maxLength) issues.push({ field, code: "TOO_LONG" });
  return value;
}

/**
 * Validates a draft goods receipt against its purchase order (ADR-005, ADR-013) and collects every
 * field/line issue at once. The order must be issued; each line receives one order line, at most
 * its ordered quantity; unit costs default from the order but may be edited (decided 2026-11-17).
 */
export function validateDraftGoodsReceipt(
  input: DraftGoodsReceiptInput,
  context: {
    readonly order: StoredPurchaseOrder;
    readonly productsById: ReadonlyMap<string, PurchaseOrderProductRef>;
    readonly today: CalendarDate;
  },
): { ok: true; value: ValidatedDraftGoodsReceipt } | DraftGoodsReceiptFailure {
  const { order } = context;
  if (order.status !== "ISSUED") return err("PURCHASE_ORDER_NOT_ISSUED");

  const issues: FieldIssue<string, GoodsReceiptIssueCode>[] = [];

  const supplierInvoiceNumber = checkNumber(
    "supplierInvoiceNumber",
    input.supplierInvoiceNumber,
    SUPPLIER_INVOICE_NUMBER_MAX_LENGTH,
    issues,
  );
  const controlNumber = checkNumber(
    "controlNumber",
    input.controlNumber,
    CONTROL_NUMBER_MAX_LENGTH,
    issues,
  );

  let parsedDate: CalendarDate | undefined;
  const dateResult = parseCalendarDate(input.documentDate);
  if (!dateResult.ok) {
    issues.push({ field: "documentDate", code: dateResult.error });
  } else if (compareCalendarDates(dateResult.value, context.today) > 0) {
    issues.push({ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" });
  } else {
    parsedDate = dateResult.value;
  }

  const orderLinesById = new Map(order.lines.map((line) => [line.id, line]));
  const seen = new Set<string>();
  const validatedLines: ValidatedGoodsReceiptLine[] = [];

  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index];
    if (line === undefined) continue;
    const prefix = `lines.${index}`;

    const orderLineId = line.purchaseOrderLineId.trim();
    const orderLine = orderLinesById.get(orderLineId);
    if (orderLineId === "") {
      issues.push({ field: `${prefix}.purchaseOrderLineId`, code: "REQUIRED" });
    } else if (!isUuid(orderLineId) || orderLine === undefined) {
      issues.push({ field: `${prefix}.purchaseOrderLineId`, code: "NOT_FOUND" });
    } else if (seen.has(orderLineId)) {
      issues.push({ field: `${prefix}.purchaseOrderLineId`, code: "DUPLICATE_LINE" });
    }
    if (orderLine !== undefined) seen.add(orderLineId);

    const product =
      orderLine === undefined ? undefined : context.productsById.get(orderLine.productId);
    const allowDecimals =
      product === undefined ? true : UNIT_ALLOWS_DECIMALS[product.unitOfMeasure];
    const quantityResult = parseQuantity(line.quantity, { allowDecimals });
    if (!quantityResult.ok) {
      issues.push({ field: `${prefix}.quantity`, code: quantityResult.error });
    } else if (orderLine !== undefined && quantityResult.value.scaled > orderLine.quantity.scaled) {
      issues.push({ field: `${prefix}.quantity`, code: "QUANTITY_EXCEEDS_ORDERED" });
    }

    let validUnitCost: Money | undefined;
    if (line.unitCost.currency !== order.currency) {
      issues.push({ field: `${prefix}.unitCost`, code: "CURRENCY_MISMATCH" });
    } else if (line.unitCost.minorUnits <= 0) {
      issues.push({ field: `${prefix}.unitCost`, code: "NOT_POSITIVE" });
    } else {
      const costResult = money(line.unitCost.minorUnits, line.unitCost.currency);
      if (!costResult.ok) {
        issues.push({
          field: `${prefix}.unitCost`,
          code: costResult.error === "AMOUNT_OUT_OF_RANGE" ? "OUT_OF_RANGE" : "INVALID",
        });
      } else {
        validUnitCost = costResult.value;
      }
    }

    if (
      orderLine !== undefined &&
      product !== undefined &&
      quantityResult.ok &&
      validUnitCost !== undefined &&
      !issues.some((issue) => issue.field.startsWith(`${prefix}.`))
    ) {
      validatedLines.push({
        position: index,
        purchaseOrderLineId: orderLine.id,
        productId: orderLine.productId,
        quantity: quantityResult.value,
        unitCost: validUnitCost,
      });
    }
  }

  if (issues.length > 0 || parsedDate === undefined) return invalid(issues);

  const totalsCheck = computeDocumentTotals(
    validatedLines.map((line) => {
      const product = context.productsById.get(line.productId);
      if (product === undefined) throw new Error(`Missing product ${line.productId}`);
      return { quantity: line.quantity, unitPrice: line.unitCost, taxRate: product.taxRate };
    }),
    order.currency,
  );
  if (!totalsCheck.ok) return invalid([{ field: "lines", code: "OUT_OF_RANGE" }]);

  return ok({
    purchaseOrderId: order.id,
    supplierId: order.supplierId,
    currency: order.currency,
    documentDate: parsedDate,
    supplierInvoiceNumber,
    controlNumber,
    status: "DRAFT",
    lines: validatedLines,
  });
}

export function reconstituteGoodsReceipt(input: {
  readonly id: string;
  readonly purchaseOrderId: string;
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: string;
  readonly supplierInvoiceNumber: string;
  readonly controlNumber: string;
  readonly status: DocumentStatus;
  readonly frozenRate: string | null;
  readonly lines: readonly StoredGoodsReceiptLine[];
}): Result<StoredGoodsReceipt, "INVALID_STORED_GOODS_RECEIPT"> {
  const documentDate = parseCalendarDate(input.documentDate);
  if (!documentDate.ok) return err("INVALID_STORED_GOODS_RECEIPT");

  let frozenRate: Rate | null = null;
  if (input.frozenRate !== null) {
    const parsedRate = parseRate(input.frozenRate);
    if (!parsedRate.ok) return err("INVALID_STORED_GOODS_RECEIPT");
    frozenRate = parsedRate.value;
  }
  if (input.status === "DRAFT" && frozenRate !== null) return err("INVALID_STORED_GOODS_RECEIPT");
  if (input.status === "ISSUED" && frozenRate === null) return err("INVALID_STORED_GOODS_RECEIPT");

  return ok({
    id: input.id,
    purchaseOrderId: input.purchaseOrderId,
    supplierId: input.supplierId,
    currency: input.currency,
    documentDate: documentDate.value,
    supplierInvoiceNumber: input.supplierInvoiceNumber,
    controlNumber: input.controlNumber,
    status: input.status,
    frozenRate,
    lines: input.lines,
  });
}

/** Issuing needs a draft with lines and a date that is not in the future, against an issued order. */
export function validateIssueGoodsReceipt(
  receipt: StoredGoodsReceipt,
  order: StoredPurchaseOrder,
  today: CalendarDate,
):
  | { readonly ok: true; readonly value: StoredGoodsReceipt }
  | IssuePreconditionFailure
  | { readonly ok: false; readonly error: "PURCHASE_ORDER_NOT_ISSUED" } {
  const check = validateDocumentIssuePreconditions({
    status: receipt.status,
    documentDate: receipt.documentDate,
    lineCount: receipt.lines.length,
    today,
  });
  if (!check.ok) return check;
  if (order.status !== "ISSUED") return err("PURCHASE_ORDER_NOT_ISSUED");
  return ok(receipt);
}

/** Same totals rules as a purchase order (IVA on the taxable base of each rate, ADR-005). */
export function calculateGoodsReceiptTotals(
  receipt: Pick<StoredGoodsReceipt, "currency" | "lines">,
  productsById: ReadonlyMap<string, PurchaseOrderProductRef>,
): DocumentTotals {
  return calculatePurchaseOrderTotals(receipt, productsById);
}

/** The VES equivalent of an issued USD receipt at its frozen rate; `null` for VES receipts or drafts. */
export function calculateGoodsReceiptVesEquivalent(
  receipt: Pick<StoredGoodsReceipt, "frozenRate">,
  total: Money,
): Money | null {
  return calculatePurchaseOrderVesEquivalent(receipt, total);
}
