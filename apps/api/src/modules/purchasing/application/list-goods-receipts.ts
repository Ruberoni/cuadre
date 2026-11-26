import { GOODS_RECEIPTS_PAGE_SIZE } from "@cuadre/contracts";
import { calculateGoodsReceiptTotals } from "../domain/goods-receipt.ts";
import type {
  EnrichedGoodsReceiptSummary,
  GoodsReceiptRepository,
} from "./goods-receipt-repository.ts";
import type { PurchasingLookups } from "./purchase-order-repository.ts";

export type ListGoodsReceiptsResult = {
  readonly items: readonly EnrichedGoodsReceiptSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export async function listGoodsReceiptsUseCase(
  repository: GoodsReceiptRepository,
  lookups: PurchasingLookups,
  { page }: { readonly page: number },
): Promise<ListGoodsReceiptsResult> {
  const { items, total } = await repository.list({ page, pageSize: GOODS_RECEIPTS_PAGE_SIZE });
  if (items.length === 0) return { items: [], total, page, pageSize: GOODS_RECEIPTS_PAGE_SIZE };

  const [suppliersById, productsById] = await Promise.all([
    lookups.findSuppliersByIds(items.map((receipt) => receipt.supplierId)),
    lookups.findProductsByIds(items.flatMap((receipt) => receipt.lines.map((l) => l.productId))),
  ]);

  return {
    items: items.map((receipt) => {
      const supplier = suppliersById.get(receipt.supplierId);
      if (supplier === undefined) {
        throw new Error(`Supplier ${receipt.supplierId} of goods receipt ${receipt.id} not found`);
      }
      return { receipt, supplier, totals: calculateGoodsReceiptTotals(receipt, productsById) };
    }),
    total,
    page,
    pageSize: GOODS_RECEIPTS_PAGE_SIZE,
  };
}
