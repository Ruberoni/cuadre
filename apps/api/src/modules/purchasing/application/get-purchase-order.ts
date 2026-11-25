import { err, ok, type Result } from "@cuadre/shared-kernel";
import { isUuid } from "../domain/purchase-order.ts";
import {
  type EnrichedPurchaseOrder,
  enrichPurchaseOrder,
  type PurchaseOrderRepository,
  type PurchasingLookups,
} from "./purchase-order-repository.ts";

export type GetPurchaseOrderResult = Result<EnrichedPurchaseOrder, "NOT_FOUND">;

export async function getPurchaseOrderUseCase(
  repository: PurchaseOrderRepository,
  lookups: PurchasingLookups,
  id: string,
): Promise<GetPurchaseOrderResult> {
  if (!isUuid(id)) return err("NOT_FOUND");

  const order = await repository.findById(id);
  if (order === null) return err("NOT_FOUND");

  const [supplier, productsById] = await Promise.all([
    lookups.findSupplierById(order.supplierId),
    lookups.findProductsByIds(order.lines.map((line) => line.productId)),
  ]);
  if (supplier === null) {
    throw new Error(
      `Supplier ${order.supplierId} referenced by purchase order ${order.id} not found`,
    );
  }

  return ok(enrichPurchaseOrder(order, supplier, productsById));
}
