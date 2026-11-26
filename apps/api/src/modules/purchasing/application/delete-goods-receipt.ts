import { err, type Result } from "@cuadre/shared-kernel";
import { isUuid } from "../domain/purchase-order.ts";
import type { GoodsReceiptRepository } from "./goods-receipt-repository.ts";

export type DeleteGoodsReceiptResult = Result<true, "NOT_FOUND" | "DOCUMENT_NOT_DRAFT">;

export async function deleteGoodsReceiptUseCase(
  repository: GoodsReceiptRepository,
  id: string,
): Promise<DeleteGoodsReceiptResult> {
  if (!isUuid(id)) return err("NOT_FOUND");
  return repository.deleteDraft(id);
}
