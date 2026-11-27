// The only public API of the inventory module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import { scaledQuantityToString } from "@cuadre/shared-kernel";
import type { Db, DbExecutor, DbTransaction } from "../../db/client.ts";
import type { InboundMovementInput, KardexLookups } from "./application/inventory-repository.ts";
import { recordInboundMovementsUseCase } from "./application/record-inbound-movements.ts";
import { deriveAverageCostUsd, deriveRoundedAverageCostUsd } from "./domain/stock.ts";
import { createKardexRoutes } from "./http/kardex.routes.ts";
import { createDrizzleInventoryRepository } from "./infrastructure/drizzle-inventory-repository.ts";

export type {
  InboundMovementInput,
  KardexLookups,
  KardexProductRef,
  RecordInboundMovementsError,
} from "./application/inventory-repository.ts";

export function createInventoryModule({ db }: { db: Db }) {
  const repository = createDrizzleInventoryRepository(db);

  return {
    /**
     * Raises stock inside the caller's transaction (ADR-008); `unitCost` is in the document's
     * currency, excluding IVA, and a VES cost converts at the document's `frozenRate` (ADR-007).
     */
    recordInboundMovements: (items: readonly InboundMovementInput[], tx: DbTransaction) =>
      recordInboundMovementsUseCase(repository, items, tx),

    /** On hand (thousandths), total value, and the derived average, for tests and later readers. */
    async getStockBalance(productId: string, tx?: DbExecutor) {
      const balance = await repository.findBalance(productId, tx);
      return {
        productId,
        onHandScaled: balance.onHandScaled,
        totalValueUsd: balance.totalValueUsd,
        averageCostUsd: deriveAverageCostUsd(balance),
        roundedAverageCostUsd: deriveRoundedAverageCostUsd(balance),
      };
    },

    /** Batch read-only on-hand lookup as canonical dot-decimal strings (e.g. `"0"`, `"150.5"`). */
    async getOnHandByProductIds(
      productIds: readonly string[],
      tx?: DbExecutor,
    ): Promise<Map<string, string>> {
      const balances = await repository.findBalancesByProductIds(productIds, tx);
      const result = new Map<string, string>();
      for (const productId of productIds) {
        const balance = balances.get(productId);
        result.set(
          productId,
          balance === undefined ? "0" : scaledQuantityToString(balance.onHandScaled),
        );
      }
      return result;
    },

    /** Mounted by the app under `/api`; receives read-only cross-module lookups at wire time. */
    createRoutes: (lookups: KardexLookups) => createKardexRoutes(repository, lookups),
  };
}

export type InventoryModule = ReturnType<typeof createInventoryModule>;
