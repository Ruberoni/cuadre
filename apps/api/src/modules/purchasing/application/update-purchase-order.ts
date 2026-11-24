import { type CalendarDate, err } from "@cuadre/shared-kernel";
import {
  calculatePurchaseOrderTotals,
  type DraftPurchaseOrderInput,
  isUuid,
  type PurchaseOrderValidationFailure,
  validateDraftPurchaseOrder,
} from "../domain/purchase-order.ts";
import type {
  EnrichedPurchaseOrder,
  PurchaseOrderRepository,
  PurchasingLookups,
} from "./purchase-order-repository.ts";

export type UpdatePurchaseOrderResult =
  | { ok: true; value: EnrichedPurchaseOrder }
  | { ok: false; error: "NOT_FOUND" | "DOCUMENT_NOT_DRAFT" }
  | PurchaseOrderValidationFailure;

export async function updatePurchaseOrderUseCase(
  repository: PurchaseOrderRepository,
  lookups: PurchasingLookups,
  id: string,
  input: DraftPurchaseOrderInput,
  today: CalendarDate,
): Promise<UpdatePurchaseOrderResult> {
  if (!isUuid(id)) return err("NOT_FOUND");

  const existing = await repository.findById(id);
  if (existing === null) return err("NOT_FOUND");
  if (existing.status !== "DRAFT") return err("DOCUMENT_NOT_DRAFT");

  const supplierId = input.supplierId.trim();
  const productIds = input.lines.map((line) => line.productId.trim()).filter(isUuid);

  const [supplier, productsById] = await Promise.all([
    isUuid(supplierId) ? lookups.findSupplierById(supplierId) : Promise.resolve(null),
    lookups.findProductsByIds(productIds),
  ]);

  const validated = validateDraftPurchaseOrder(input, {
    supplierExists: supplier !== null,
    productsById,
    today,
  });
  if (!validated.ok) return validated;

  const updated = await repository.updateDraft(id, validated.value);
  if (!updated.ok) return updated;

  if (supplier === null) {
    throw new Error(`Supplier ${updated.value.supplierId} vanished after validation`);
  }

  return {
    ok: true,
    value: {
      order: updated.value,
      supplier,
      productsById,
      totals: calculatePurchaseOrderTotals(updated.value, productsById),
    },
  };
}
