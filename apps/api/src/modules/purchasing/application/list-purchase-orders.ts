import { PURCHASE_ORDERS_PAGE_SIZE } from "@cuadre/contracts";
import { calculatePurchaseOrderTotals } from "../domain/purchase-order.ts";
import type {
  EnrichedPurchaseOrder,
  PurchaseOrderRepository,
  PurchasingLookups,
} from "./purchase-order-repository.ts";

export type ListPurchaseOrdersResult = {
  readonly items: readonly EnrichedPurchaseOrder[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export async function listPurchaseOrdersUseCase(
  repository: PurchaseOrderRepository,
  lookups: PurchasingLookups,
  { page }: { readonly page: number },
): Promise<ListPurchaseOrdersResult> {
  const { items, total } = await repository.list({ page, pageSize: PURCHASE_ORDERS_PAGE_SIZE });
  if (items.length === 0) {
    return { items: [], total, page, pageSize: PURCHASE_ORDERS_PAGE_SIZE };
  }

  const supplierIds = items.map((order) => order.supplierId);
  const productIds = items.flatMap((order) => order.lines.map((line) => line.productId));

  const [suppliersById, productsById] = await Promise.all([
    lookups.findSuppliersByIds(supplierIds),
    lookups.findProductsByIds(productIds),
  ]);

  const enriched: EnrichedPurchaseOrder[] = items.map((order) => {
    const supplier = suppliersById.get(order.supplierId);
    if (supplier === null || supplier === undefined) {
      throw new Error(
        `Supplier ${order.supplierId} referenced by purchase order ${order.id} not found`,
      );
    }
    return {
      order,
      supplier,
      productsById,
      totals: calculatePurchaseOrderTotals(order, productsById),
    };
  });

  return {
    items: enriched,
    total,
    page,
    pageSize: PURCHASE_ORDERS_PAGE_SIZE,
  };
}
