import { type CalendarDate, err } from "@cuadre/shared-kernel";
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

export type UpdateGoodsReceiptResult =
  | { ok: true; value: EnrichedGoodsReceipt }
  | { ok: false; error: "NOT_FOUND" | "DOCUMENT_NOT_DRAFT" }
  | DraftGoodsReceiptFailure;

export async function updateGoodsReceiptUseCase(
  deps: GoodsReceiptDeps,
  id: string,
  input: Omit<DraftGoodsReceiptInput, "purchaseOrderId">,
  today: CalendarDate,
): Promise<UpdateGoodsReceiptResult> {
  if (!isUuid(id)) return err("NOT_FOUND");

  const existing = await deps.repository.findById(id);
  if (existing === null) return err("NOT_FOUND");
  if (existing.status !== "DRAFT") return err("DOCUMENT_NOT_DRAFT");

  const order = await deps.orders.findById(existing.purchaseOrderId);
  if (order === null) {
    throw new Error(`Purchase order ${existing.purchaseOrderId} of receipt ${id} not found`);
  }
  const [supplier, productsById] = await Promise.all([
    deps.lookups.findSupplierById(order.supplierId),
    deps.lookups.findProductsByIds(order.lines.map((line) => line.productId)),
  ]);
  if (supplier === null) {
    throw new Error(`Supplier ${order.supplierId} of purchase order ${order.id} not found`);
  }

  // The order of a receipt never changes: the body cannot move it to another one.
  const validated = validateDraftGoodsReceipt(
    { ...input, purchaseOrderId: order.id },
    { order, productsById, today },
  );
  if (!validated.ok) return validated;

  const updated = await deps.repository.updateDraft(id, validated.value);
  if (!updated.ok) return updated;
  return { ok: true, value: enrichGoodsReceipt(updated.value, order, supplier, productsById) };
}
