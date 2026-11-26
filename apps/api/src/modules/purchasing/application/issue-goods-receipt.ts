import {
  type CalendarDate,
  err,
  type IssuePreconditionFailure,
  invalid,
  ok,
} from "@cuadre/shared-kernel";
import type { Db } from "../../../db/client.ts";
import { issueDocument } from "../../../shared/issue-document.ts";
import type { InventoryModule, RecordInboundMovementsError } from "../../inventory/index.ts";
import {
  calculateGoodsReceiptTotals,
  type GoodsReceiptValidationFailure,
  type StoredGoodsReceipt,
  validateIssueGoodsReceipt,
} from "../domain/goods-receipt.ts";
import {
  isUuid,
  type PurchaseOrderProductRef,
  type StoredPurchaseOrder,
  validatePurchaseOrderVesEquivalent,
} from "../domain/purchase-order.ts";
import {
  type EnrichedGoodsReceipt,
  enrichGoodsReceipt,
  type GoodsReceiptDeps,
} from "./goods-receipt-repository.ts";
import type { IssuePurchaseOrderExchangeRates } from "./issue-purchase-order.ts";

export type IssueGoodsReceiptResult =
  | { readonly ok: true; readonly value: EnrichedGoodsReceipt }
  | {
      readonly ok: false;
      readonly error:
        | "NOT_FOUND"
        | "DOCUMENT_NOT_DRAFT"
        | "EMPTY_DOCUMENT"
        | "PURCHASE_ORDER_NOT_ISSUED";
    }
  | {
      readonly ok: false;
      readonly error: "MISSING_EXCHANGE_RATE";
      readonly date: CalendarDate;
    }
  | {
      readonly ok: false;
      readonly error: "VALIDATION_ERROR";
      readonly issues: readonly { field: string; code: string }[];
    };

/** Why raising the stock failed, as the field issue on the receipt's lines. */
const STOCK_FAILURE_CODE = {
  AMOUNT_OUT_OF_RANGE: "AMOUNT_OUT_OF_RANGE",
  QUANTITY_OUT_OF_RANGE: "OUT_OF_RANGE",
  INVALID_COST: "INVALID",
} as const satisfies Record<RecordInboundMovementsError, string>;

/**
 * Issues a goods receipt in one transaction (ADR-008, ADR-013): freezes the receipt's own rate,
 * raises the stock of every line (the order's unit cost is not touched), and marks it `ISSUED`.
 * Any expected failure rolls back all of it, the rate freeze included.
 */
export async function issueGoodsReceiptUseCase(
  deps: GoodsReceiptDeps & {
    readonly db: Db;
    readonly exchangeRates: IssuePurchaseOrderExchangeRates;
    readonly inventory: Pick<InventoryModule, "recordInboundMovements">;
  },
  id: string,
  today: CalendarDate,
): Promise<IssueGoodsReceiptResult> {
  if (!isUuid(id)) return err("NOT_FOUND");

  const issued = await issueDocument<
    {
      readonly documentDate: CalendarDate;
      readonly receipt: StoredGoodsReceipt;
      readonly order: StoredPurchaseOrder;
    },
    {
      readonly receipt: StoredGoodsReceipt;
      readonly order: StoredPurchaseOrder;
      readonly productsById: ReadonlyMap<string, PurchaseOrderProductRef>;
    },
    | { readonly ok: false; readonly error: "NOT_FOUND" | "PURCHASE_ORDER_NOT_ISSUED" }
    | IssuePreconditionFailure,
    GoodsReceiptValidationFailure
  >({
    db: deps.db,
    today,
    lookupAndFreezeForDate: deps.exchangeRates.lookupAndFreezeForDate,
    lockAndValidate: async (tx, currentToday) => {
      const receipt = await deps.repository.lockForIssue(id, tx);
      if (receipt === null) return err("NOT_FOUND");
      const order = await deps.orders.findById(receipt.purchaseOrderId);
      if (order === null) {
        throw new Error(`Purchase order ${receipt.purchaseOrderId} of receipt ${id} not found`);
      }
      const valid = validateIssueGoodsReceipt(receipt, order, currentToday);
      if (!valid.ok) return valid;
      return ok({ documentDate: receipt.documentDate, receipt, order });
    },
    persistIssued: async ({ receipt, order }, frozenRate, tx) => {
      const productsById = await deps.lookups.findProductsByIds(
        order.lines.map((line) => line.productId),
        tx,
      );
      const totals = calculateGoodsReceiptTotals(receipt, productsById);
      const vesValidation = validatePurchaseOrderVesEquivalent(totals.total, frozenRate);
      if (!vesValidation.ok) return vesValidation;

      const stock = await deps.inventory.recordInboundMovements(
        receipt.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          frozenRate,
          referenceType: "GOODS_RECEIPT",
          referenceId: receipt.id,
          documentDate: receipt.documentDate,
        })),
        tx,
      );
      if (!stock.ok) return invalid([{ field: "lines", code: STOCK_FAILURE_CODE[stock.error] }]);

      const updated = await deps.repository.markIssued(receipt.id, frozenRate, tx);
      return ok({ receipt: updated, order, productsById });
    },
  });
  if (!issued.ok) return issued;

  const supplier = await deps.lookups.findSupplierById(issued.value.receipt.supplierId);
  if (supplier === null) {
    throw new Error(`Supplier ${issued.value.receipt.supplierId} of goods receipt not found`);
  }
  return ok(
    enrichGoodsReceipt(
      issued.value.receipt,
      issued.value.order,
      supplier,
      issued.value.productsById,
    ),
  );
}
