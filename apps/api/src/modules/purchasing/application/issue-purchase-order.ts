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
  isUuid,
  type StoredPurchaseOrder,
  validateIssuePurchaseOrder,
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
    StoredPurchaseOrder,
    { readonly ok: false; readonly error: "NOT_FOUND" } | IssuePreconditionFailure,
    never
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
      const updated = await deps.repository.markIssued(order.id, frozenRate, tx);
      return ok(updated);
    },
  });

  if (!issued.ok) return issued;

  const [supplier, productsById] = await Promise.all([
    deps.lookups.findSupplierById(issued.value.supplierId),
    deps.lookups.findProductsByIds(issued.value.lines.map((line) => line.productId)),
  ]);
  if (supplier === null) {
    throw new Error(
      `Supplier ${issued.value.supplierId} referenced by purchase order ${issued.value.id} not found`,
    );
  }

  return ok(enrichPurchaseOrder(issued.value, supplier, productsById));
}
