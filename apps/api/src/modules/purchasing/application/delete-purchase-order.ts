import { err, type Result } from "@cuadre/shared-kernel";
import { isUuid } from "../domain/purchase-order.ts";
import type { PurchaseOrderRepository } from "./purchase-order-repository.ts";

export type DeletePurchaseOrderResult = Result<true, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">;

export async function deletePurchaseOrderUseCase(
  repository: PurchaseOrderRepository,
  id: string,
): Promise<DeletePurchaseOrderResult> {
  if (!isUuid(id)) return err("NOT_FOUND");
  return repository.deleteDraft(id);
}
