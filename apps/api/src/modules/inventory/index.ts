// The only public API of the inventory module (ADR-001): other code imports from here, never from
// domain/, application/ or infrastructure/.
import type { Db, DbTransaction } from "../../db/client.ts";
import type { InboundMovementInput } from "./application/inventory-repository.ts";
import { recordInboundMovementsUseCase } from "./application/record-inbound-movements.ts";
import { deriveAverageCostUsd, deriveRoundedAverageCostUsd } from "./domain/stock.ts";
import { createDrizzleInventoryRepository } from "./infrastructure/drizzle-inventory-repository.ts";

export type {
  InboundMovementInput,
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
    async getStockBalance(productId: string, tx?: DbTransaction) {
      const balance = await repository.findBalance(productId, tx);
      return {
        productId,
        onHandScaled: balance.onHandScaled,
        totalValueUsd: balance.totalValueUsd,
        averageCostUsd: deriveAverageCostUsd(balance),
        roundedAverageCostUsd: deriveRoundedAverageCostUsd(balance),
      };
    },
  };
}

export type InventoryModule = ReturnType<typeof createInventoryModule>;
