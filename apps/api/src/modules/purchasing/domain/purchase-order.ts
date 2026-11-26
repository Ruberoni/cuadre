import {
  type DocumentStatus,
  type PurchaseOrderIssueCode,
  UNIT_ALLOWS_DECIMALS,
  type UnitOfMeasure,
} from "@cuadre/contracts";
import {
  type CalendarDate,
  type Currency,
  compareCalendarDates,
  computeDocumentTotals,
  computeVesEquivalent,
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
  type TaxRate,
  type ValidationFailure,
  validateDocumentIssuePreconditions,
} from "@cuadre/shared-kernel";

export type PurchaseOrderProductRef = {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly unitOfMeasure: UnitOfMeasure;
  readonly taxRate: TaxRate;
};

export type PurchaseOrderSupplierRef = {
  readonly id: string;
  readonly rif: string;
  readonly name: string;
};

export type DraftPurchaseOrderLineInput = {
  readonly productId: string;
  readonly quantity: string;
  readonly unitCost: { readonly minorUnits: number; readonly currency: Currency };
};

export type DraftPurchaseOrderInput = {
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: string;
  readonly lines: readonly DraftPurchaseOrderLineInput[];
};

export type ValidatedPurchaseOrderLine = {
  readonly position: number;
  readonly productId: string;
  readonly quantity: Quantity;
  readonly unitCost: Money;
};

export type ValidatedDraftPurchaseOrder = {
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: CalendarDate;
  readonly status: "DRAFT";
  readonly lines: readonly ValidatedPurchaseOrderLine[];
};

export type StoredPurchaseOrderLine = {
  readonly id: string;
  readonly position: number;
  readonly productId: string;
  readonly quantity: Quantity;
  readonly unitCost: Money;
};

export type StoredPurchaseOrder = {
  readonly id: string;
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: CalendarDate;
  readonly status: DocumentStatus;
  readonly frozenRate: Rate | null;
  readonly lines: readonly StoredPurchaseOrderLine[];
};

export type PurchaseOrderValidationFailure = ValidationFailure<string, PurchaseOrderIssueCode>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Validates a draft purchase order against all domain rules (ADR-005, ADR-013) and collects every
 * field/line issue at once. Empty `lines` is allowed in Draft.
 */
export function validateDraftPurchaseOrder(
  input: DraftPurchaseOrderInput,
  context: {
    readonly supplierExists: boolean;
    readonly productsById: ReadonlyMap<string, PurchaseOrderProductRef>;
    readonly today: CalendarDate;
  },
): { ok: true; value: ValidatedDraftPurchaseOrder } | PurchaseOrderValidationFailure {
  const issues: FieldIssue<string, PurchaseOrderIssueCode>[] = [];

  const supplierId = input.supplierId.trim();
  if (supplierId === "") {
    issues.push({ field: "supplierId", code: "REQUIRED" });
  } else if (!isUuid(supplierId) || !context.supplierExists) {
    issues.push({ field: "supplierId", code: "NOT_FOUND" });
  }

  let parsedDate: CalendarDate | undefined;
  const dateResult = parseCalendarDate(input.documentDate);
  if (!dateResult.ok) {
    issues.push({ field: "documentDate", code: dateResult.error });
  } else if (compareCalendarDates(dateResult.value, context.today) > 0) {
    issues.push({ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" });
  } else {
    parsedDate = dateResult.value;
  }

  const validatedLines: ValidatedPurchaseOrderLine[] = [];
  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index];
    if (line === undefined) continue;
    const prefix = `lines.${index}`;

    const productId = line.productId.trim();
    const product = productId === "" ? undefined : context.productsById.get(productId);
    if (productId === "") {
      issues.push({ field: `${prefix}.productId`, code: "REQUIRED" });
    } else if (!isUuid(productId) || product === undefined) {
      issues.push({ field: `${prefix}.productId`, code: "NOT_FOUND" });
    }

    const allowDecimals =
      product === undefined ? true : UNIT_ALLOWS_DECIMALS[product.unitOfMeasure];
    const quantityResult = parseQuantity(line.quantity, { allowDecimals });
    if (!quantityResult.ok) {
      issues.push({ field: `${prefix}.quantity`, code: quantityResult.error });
    }

    let validUnitCost: Money | undefined;
    if (line.unitCost.currency !== input.currency) {
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

    if (product !== undefined && quantityResult.ok && validUnitCost !== undefined) {
      validatedLines.push({
        position: index,
        productId: product.id,
        quantity: quantityResult.value,
        unitCost: validUnitCost,
      });
    }
  }

  if (issues.length > 0 || parsedDate === undefined) {
    return invalid(issues);
  }

  // Verify totals do not overflow Money range.
  const totalsCheck = computeDocumentTotals(
    validatedLines.map((line) => {
      const product = context.productsById.get(line.productId);
      if (product === undefined) throw new Error(`Missing product ${line.productId}`);
      return { quantity: line.quantity, unitPrice: line.unitCost, taxRate: product.taxRate };
    }),
    input.currency,
  );
  if (!totalsCheck.ok) {
    return invalid([{ field: "lines", code: "OUT_OF_RANGE" }]);
  }

  return ok({
    supplierId,
    currency: input.currency,
    documentDate: parsedDate,
    status: "DRAFT",
    lines: validatedLines,
  });
}

export function calculatePurchaseOrderTotals(
  order: Pick<StoredPurchaseOrder, "currency" | "lines">,
  productsById: ReadonlyMap<string, PurchaseOrderProductRef>,
): DocumentTotals {
  const result = computeDocumentTotals(
    order.lines.map((line) => {
      const product = productsById.get(line.productId);
      if (product === undefined) {
        throw new Error(`Product ${line.productId} referenced by purchase order not found`);
      }
      return {
        quantity: line.quantity,
        unitPrice: line.unitCost,
        taxRate: product.taxRate,
      };
    }),
    order.currency,
  );
  if (!result.ok) {
    throw new Error(`Failed to compute purchase order totals: ${result.error}`);
  }
  return result.value;
}

export function reconstitutePurchaseOrder(input: {
  readonly id: string;
  readonly supplierId: string;
  readonly currency: Currency;
  readonly documentDate: string;
  readonly status: DocumentStatus;
  readonly frozenRate: string | null;
  readonly lines: readonly StoredPurchaseOrderLine[];
}): Result<StoredPurchaseOrder, "INVALID_STORED_PURCHASE_ORDER"> {
  const documentDate = parseCalendarDate(input.documentDate);
  if (!documentDate.ok) return err("INVALID_STORED_PURCHASE_ORDER");

  let frozenRate: Rate | null = null;
  if (input.frozenRate !== null) {
    const parsedRate = parseRate(input.frozenRate);
    if (!parsedRate.ok) return err("INVALID_STORED_PURCHASE_ORDER");
    frozenRate = parsedRate.value;
  }

  if (input.status === "DRAFT" && frozenRate !== null) {
    return err("INVALID_STORED_PURCHASE_ORDER");
  }
  if (input.status === "ISSUED" && frozenRate === null) {
    return err("INVALID_STORED_PURCHASE_ORDER");
  }

  return ok({
    id: input.id,
    supplierId: input.supplierId,
    currency: input.currency,
    documentDate: documentDate.value,
    status: input.status,
    frozenRate,
    lines: input.lines,
  });
}

export function validateIssuePurchaseOrder(
  order: StoredPurchaseOrder,
  today: CalendarDate,
): { readonly ok: true; readonly value: StoredPurchaseOrder } | IssuePreconditionFailure {
  const check = validateDocumentIssuePreconditions({
    status: order.status,
    documentDate: order.documentDate,
    lineCount: order.lines.length,
    today,
  });
  if (!check.ok) return check;
  return ok(order);
}

export function validatePurchaseOrderVesEquivalent(
  total: Money,
  frozenRate: Rate,
): { readonly ok: true; readonly value: Money | null } | PurchaseOrderValidationFailure {
  const result = computeVesEquivalent(total, frozenRate);
  if (!result.ok) {
    return invalid([{ field: "lines", code: result.error }]);
  }
  return result;
}

export function calculatePurchaseOrderVesEquivalent(
  order: Pick<StoredPurchaseOrder, "frozenRate">,
  total: Money,
): Money | null {
  if (order.frozenRate === null) return null;
  const result = computeVesEquivalent(total, order.frozenRate);
  if (!result.ok) {
    throw new Error(`Failed to compute VES equivalent for purchase order: ${result.error}`);
  }
  return result.value;
}
