import { err, ok, type Result } from "@cuadre/shared-kernel";
import { isUuid } from "../domain/purchase-order.ts";
import {
  type EnrichedGoodsReceipt,
  enrichGoodsReceipt,
  type GoodsReceiptDeps,
} from "./goods-receipt-repository.ts";

export type GetGoodsReceiptResult = Result<EnrichedGoodsReceipt, "NOT_FOUND">;

export async function getGoodsReceiptUseCase(
  deps: GoodsReceiptDeps,
  id: string,
): Promise<GetGoodsReceiptResult> {
  if (!isUuid(id)) return err("NOT_FOUND");

  const receipt = await deps.repository.findById(id);
  if (receipt === null) return err("NOT_FOUND");
  const order = await deps.orders.findById(receipt.purchaseOrderId);
  if (order === null) {
    throw new Error(`Purchase order ${receipt.purchaseOrderId} of receipt ${id} not found`);
  }

  const [supplier, productsById] = await Promise.all([
    deps.lookups.findSupplierById(receipt.supplierId),
    deps.lookups.findProductsByIds(order.lines.map((line) => line.productId)),
  ]);
  if (supplier === null) {
    throw new Error(`Supplier ${receipt.supplierId} of goods receipt ${id} not found`);
  }
  return ok(enrichGoodsReceipt(receipt, order, supplier, productsById));
}
