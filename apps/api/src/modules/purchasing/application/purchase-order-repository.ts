import type { DocumentTotals, Result } from "@cuadre/shared-kernel";
import type {
  PurchaseOrderProductRef,
  PurchaseOrderSupplierRef,
  StoredPurchaseOrder,
  ValidatedDraftPurchaseOrder,
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
};

export type PurchaseOrderRepository = {
  insert(order: ValidatedDraftPurchaseOrder): Promise<StoredPurchaseOrder>;
  updateDraft(
    id: string,
    order: ValidatedDraftPurchaseOrder,
  ): Promise<Result<StoredPurchaseOrder, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">>;
  deleteDraft(id: string): Promise<Result<true, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">>;
  findById(id: string): Promise<StoredPurchaseOrder | null>;
  list(params: PurchaseOrderListParams): Promise<{ items: StoredPurchaseOrder[]; total: number }>;
  count(): Promise<number>;
};

export type PurchasingLookups = {
  findSupplierById(id: string): Promise<PurchaseOrderSupplierRef | null>;
  findSuppliersByIds(ids: readonly string[]): Promise<Map<string, PurchaseOrderSupplierRef>>;
  findProductsByIds(ids: readonly string[]): Promise<Map<string, PurchaseOrderProductRef>>;
};
