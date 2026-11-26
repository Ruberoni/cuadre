import { type CalendarDate, err, ok } from "@cuadre/shared-kernel";
import {
  type DraftGoodsReceiptFailure,
  type DraftGoodsReceiptInput,
  validateDraftGoodsReceipt,
} from "../domain/goods-receipt.ts";
import { isUuid } from "../domain/purchase-order.ts";
import {
  type EnrichedGoodsReceipt,
  enrichGoodsReceipt,
  type GoodsReceiptDeps,
} from "./goods-receipt-repository.ts";

export type CreateGoodsReceiptResult =
  | { ok: true; value: EnrichedGoodsReceipt }
  | { ok: false; error: "GOODS_RECEIPT_ALREADY_EXISTS" }
  | DraftGoodsReceiptFailure;

export async function createGoodsReceiptUseCase(
  deps: GoodsReceiptDeps,
  input: DraftGoodsReceiptInput,
  today: CalendarDate,
): Promise<CreateGoodsReceiptResult> {
  const orderId = input.purchaseOrderId.trim();
  if (orderId === "") {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "purchaseOrderId", code: "REQUIRED" }],
    };
  }
  const order = isUuid(orderId) ? await deps.orders.findById(orderId) : null;
  if (order === null) {
    return {
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "purchaseOrderId", code: "NOT_FOUND" }],
    };
  }

  // One receipt per order (1:1): a second one fails before its fields are looked at.
  if ((await deps.repository.findByPurchaseOrderId(order.id)) !== null) {
    return err("GOODS_RECEIPT_ALREADY_EXISTS");
  }

  const [supplier, productsById] = await Promise.all([
    deps.lookups.findSupplierById(order.supplierId),
    deps.lookups.findProductsByIds(order.lines.map((line) => line.productId)),
  ]);
  if (supplier === null) {
    throw new Error(
      `Supplier ${order.supplierId} referenced by purchase order ${order.id} not found`,
    );
  }

  const validated = validateDraftGoodsReceipt(input, { order, productsById, today });
  if (!validated.ok) return validated;

  const stored = await deps.repository.insert(validated.value);
  if (!stored.ok) return stored;
  return ok(enrichGoodsReceipt(stored.value, order, supplier, productsById));
}
