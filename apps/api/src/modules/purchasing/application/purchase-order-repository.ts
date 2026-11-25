import type { DocumentTotals, Money, Rate, Result } from "@cuadre/shared-kernel";
import type { DbTransaction } from "../../../db/client.ts";
import {
  calculatePurchaseOrderTotals,
  calculatePurchaseOrderVesEquivalent,
  type PurchaseOrderProductRef,
  type PurchaseOrderSupplierRef,
  type StoredPurchaseOrder,
  type ValidatedDraftPurchaseOrder,
} from "../domain/purchase-order.ts";

export type PurchaseOrderListParams = {
  readonly page: number;
  readonly pageSize: number;
};

export type EnrichedPurchaseOrder = {
  readonly order: StoredPurchaseOrder;
  readonly supplier: PurchaseOrderSupplierRef;
  readonly productsById: ReadonlyMap<string, PurchaseOrderProductRef>;
  readonly totals: DocumentTotals;
  readonly vesTotalEquivalent: Money | null;
};

export function enrichPurchaseOrder(
  order: StoredPurchaseOrder,
  supplier: PurchaseOrderSupplierRef,
  productsById: ReadonlyMap<string, PurchaseOrderProductRef>,
): EnrichedPurchaseOrder {
  const totals = calculatePurchaseOrderTotals(order, productsById);
  return {
    order,
    supplier,
    productsById,
    totals,
    vesTotalEquivalent: calculatePurchaseOrderVesEquivalent(order, totals.total),
  };
}

export type PurchaseOrderRepository = {
  insert(order: ValidatedDraftPurchaseOrder): Promise<StoredPurchaseOrder>;
  updateDraft(
    id: string,
    order: ValidatedDraftPurchaseOrder,
  ): Promise<Result<StoredPurchaseOrder, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">>;
  deleteDraft(id: string): Promise<Result<true, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">>;
  lockForIssue(id: string, tx: DbTransaction): Promise<StoredPurchaseOrder | null>;
  markIssued(id: string, frozenRate: Rate, tx: DbTransaction): Promise<StoredPurchaseOrder>;
  findById(id: string): Promise<StoredPurchaseOrder | null>;
  list(params: PurchaseOrderListParams): Promise<{ items: StoredPurchaseOrder[]; total: number }>;
  count(): Promise<number>;
};

export type PurchasingLookups = {
  findSupplierById(id: string): Promise<PurchaseOrderSupplierRef | null>;
  findSuppliersByIds(ids: readonly string[]): Promise<Map<string, PurchaseOrderSupplierRef>>;
  findProductsByIds(ids: readonly string[]): Promise<Map<string, PurchaseOrderProductRef>>;
};
