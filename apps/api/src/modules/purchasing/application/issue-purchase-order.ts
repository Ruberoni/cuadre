import {
  type CalendarDate,
  err,
  type IssuePreconditionFailure,
  ok,
  type Rate,
  type Result,
  type ValidationFailure,
} from "@cuadre/shared-kernel";
import type { Db, DbTransaction } from "../../../db/client.ts";
import { issueDocument } from "../../../shared/issue-document.ts";
import {
  calculatePurchaseOrderTotals,
  isUuid,
  type PurchaseOrderProductRef,
  type PurchaseOrderValidationFailure,
  type StoredPurchaseOrder,
  validateIssuePurchaseOrder,
  validatePurchaseOrderVesEquivalent,
} from "../domain/purchase-order.ts";
import {
  type EnrichedPurchaseOrder,
  enrichPurchaseOrder,
  type PurchaseOrderRepository,
  type PurchasingLookups,
} from "./purchase-order-repository.ts";

export type IssuePurchaseOrderExchangeRates = {
  lookupAndFreezeForDate(
    date: string,
    tx: DbTransaction,
  ): Promise<
    Result<{ readonly rate: Rate }, "MISSING_EXCHANGE_RATE"> | ValidationFailure<string, string>
  >;
};

export type IssuePurchaseOrderResult =
  | { readonly ok: true; readonly value: EnrichedPurchaseOrder }
  | { readonly ok: false; readonly error: "NOT_FOUND" | "DOCUMENT_NOT_DRAFT" | "EMPTY_DOCUMENT" }
  | {
      readonly ok: false;
      readonly error: "MISSING_EXCHANGE_RATE";
      readonly date: CalendarDate;
    }
  | ValidationFailure<string, string>;

export async function issuePurchaseOrderUseCase(
  deps: {
    readonly db: Db;
    readonly repository: PurchaseOrderRepository;
    readonly lookups: PurchasingLookups;
    readonly exchangeRates: IssuePurchaseOrderExchangeRates;
  },
  id: string,
  today: CalendarDate,
): Promise<IssuePurchaseOrderResult> {
  if (!isUuid(id)) return err("NOT_FOUND");

  const issued = await issueDocument<
    StoredPurchaseOrder,
    {
      readonly order: StoredPurchaseOrder;
      readonly productsById: ReadonlyMap<string, PurchaseOrderProductRef>;
    },
    { readonly ok: false; readonly error: "NOT_FOUND" } | IssuePreconditionFailure,
    PurchaseOrderValidationFailure
  >({
    db: deps.db,
    today,
    lookupAndFreezeForDate: deps.exchangeRates.lookupAndFreezeForDate,
    lockAndValidate: async (tx, currentToday) => {
      const order = await deps.repository.lockForIssue(id, tx);
      if (order === null) return err("NOT_FOUND");
      const valid = validateIssuePurchaseOrder(order, currentToday);
      if (!valid.ok) return valid;
      return ok(valid.value);
    },
    persistIssued: async (order, frozenRate, tx) => {
      const productsById = await deps.lookups.findProductsByIds(
        order.lines.map((line) => line.productId),
        tx,
      );
      const totals = calculatePurchaseOrderTotals(order, productsById);
      const vesValidation = validatePurchaseOrderVesEquivalent(totals.total, frozenRate);
      if (!vesValidation.ok) return vesValidation;

      const updated = await deps.repository.markIssued(order.id, frozenRate, tx);
      return ok({ order: updated, productsById });
    },
  });

  if (!issued.ok) return issued;

  const supplier = await deps.lookups.findSupplierById(issued.value.order.supplierId);
  if (supplier === null) {
    throw new Error(
      `Supplier ${issued.value.order.supplierId} referenced by purchase order ${issued.value.order.id} not found`,
    );
  }

  return ok(enrichPurchaseOrder(issued.value.order, supplier, issued.value.productsById));
}
