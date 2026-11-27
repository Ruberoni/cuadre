import { err, ok } from "@cuadre/shared-kernel";
import type { DbTransaction } from "../../../db/client.ts";
import { applyInboundMovement, computeInboundCostUsd } from "../domain/stock.ts";
import type {
  InboundMovementInput,
  InventoryRepository,
  RecordInboundMovementsResult,
  StockMovementRow,
} from "./inventory-repository.ts";

/**
 * Raises the stock of every line inside the caller's transaction (ADR-008): it never opens one of
 * its own, so a failure anywhere in the caller leaves no movement behind. Balances are locked in
 * product-id order, so two receipts touching the same products cannot deadlock.
 */
export async function recordInboundMovementsUseCase(
  repository: InventoryRepository,
  items: readonly InboundMovementInput[],
  tx: DbTransaction,
): Promise<RecordInboundMovementsResult> {
  if (items.length === 0) return ok(true);

  const productIds = [...new Set(items.map((item) => item.productId))].sort();
  const balances = await repository.lockBalances(productIds, tx);
  const movements: StockMovementRow[] = [];

  for (const item of items) {
    const current = balances.get(item.productId);
    if (current === undefined) throw new Error(`No stock balance locked for ${item.productId}`);

    const cost = computeInboundCostUsd(item.quantity, item.unitCost, item.frozenRate);
    if (!cost.ok) return err(cost.error);
    const next = applyInboundMovement(current, {
      quantity: item.quantity,
      totalCostUsd: cost.value,
    });
    if (!next.ok) return err(next.error);

    balances.set(item.productId, next.value);
    movements.push({
      productId: item.productId,
      direction: "INBOUND",
      quantityScaled: item.quantity.scaled,
      totalCostUsdMinor: cost.value.minorUnits,
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      documentDate: item.documentDate,
    });
  }

  for (const productId of productIds) {
    const balance = balances.get(productId);
    if (balance !== undefined) await repository.saveBalance(balance, tx);
  }
  await repository.insertMovements(movements, tx);
  return ok(true);
}
