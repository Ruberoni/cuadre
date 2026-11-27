import type { DocumentTotals, Money, Rate, Result } from "@cuadre/shared-kernel";
import type { DbTransaction } from "../../../db/client.ts";
import {
  calculateGoodsReceiptTotals,
  calculateGoodsReceiptVesEquivalent,
  type StoredGoodsReceipt,
  type ValidatedDraftGoodsReceipt,
} from "../domain/goods-receipt.ts";
import type {
  PurchaseOrderProductRef,
  PurchaseOrderSupplierRef,
  StoredPurchaseOrder,
} from "../domain/purchase-order.ts";
import type { PurchaseOrderRepository, PurchasingLookups } from "./purchase-order-repository.ts";

type GoodsReceiptListParams = { readonly page: number; readonly pageSize: number };

export type EnrichedGoodsReceipt = {
  readonly receipt: StoredGoodsReceipt;
  readonly order: StoredPurchaseOrder;
  readonly supplier: PurchaseOrderSupplierRef;
  readonly productsById: ReadonlyMap<string, PurchaseOrderProductRef>;
  readonly totals: DocumentTotals;
  readonly vesTotalEquivalent: Money | null;
};

export type EnrichedGoodsReceiptSummary = {
  readonly receipt: StoredGoodsReceipt;
  readonly supplier: PurchaseOrderSupplierRef;
  readonly totals: DocumentTotals;
};

export function enrichGoodsReceipt(
  receipt: StoredGoodsReceipt,
  order: StoredPurchaseOrder,
  supplier: PurchaseOrderSupplierRef,
  productsById: ReadonlyMap<string, PurchaseOrderProductRef>,
): EnrichedGoodsReceipt {
  const totals = calculateGoodsReceiptTotals(receipt, productsById);
  return {
    receipt,
    order,
    supplier,
    productsById,
    totals,
    vesTotalEquivalent: calculateGoodsReceiptVesEquivalent(receipt, totals.total),
  };
}

export type GoodsReceiptRepository = {
  /** `GOODS_RECEIPT_ALREADY_EXISTS` when the order already has one (unique index, so races lose too). */
  insert(
    receipt: ValidatedDraftGoodsReceipt,
  ): Promise<Result<StoredGoodsReceipt, "GOODS_RECEIPT_ALREADY_EXISTS">>;
  updateDraft(
    id: string,
    receipt: ValidatedDraftGoodsReceipt,
  ): Promise<Result<StoredGoodsReceipt, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">>;
  deleteDraft(id: string): Promise<Result<true, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">>;
  lockForIssue(id: string, tx: DbTransaction): Promise<StoredGoodsReceipt | null>;
  markIssued(id: string, frozenRate: Rate, tx: DbTransaction): Promise<StoredGoodsReceipt>;
  findById(id: string): Promise<StoredGoodsReceipt | null>;
  findByPurchaseOrderId(purchaseOrderId: string): Promise<StoredGoodsReceipt | null>;
  list(params: GoodsReceiptListParams): Promise<{ items: StoredGoodsReceipt[]; total: number }>;
};

/** What the goods-receipt use cases need from the purchasing module itself. */
export type GoodsReceiptDeps = {
  readonly repository: GoodsReceiptRepository;
  readonly orders: Pick<PurchaseOrderRepository, "findById">;
  readonly lookups: PurchasingLookups;
};
