import type { CalendarDate } from "@cuadre/shared-kernel";
import {
  type DraftPurchaseOrderInput,
  isUuid,
  type PurchaseOrderValidationFailure,
  validateDraftPurchaseOrder,
} from "../domain/purchase-order.ts";
import {
  type EnrichedPurchaseOrder,
  enrichPurchaseOrder,
  type PurchaseOrderRepository,
  type PurchasingLookups,
} from "./purchase-order-repository.ts";

export type CreatePurchaseOrderResult =
  | { ok: true; value: EnrichedPurchaseOrder }
  | PurchaseOrderValidationFailure;

export async function createPurchaseOrderUseCase(
  repository: PurchaseOrderRepository,
  lookups: PurchasingLookups,
  input: DraftPurchaseOrderInput,
  today: CalendarDate,
): Promise<CreatePurchaseOrderResult> {
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

  const stored = await repository.insert(validated.value);
  if (supplier === null) {
    throw new Error(`Supplier ${stored.supplierId} vanished after validation`);
  }

  return {
    ok: true,
    value: enrichPurchaseOrder(stored, supplier, productsById),
  };
}
