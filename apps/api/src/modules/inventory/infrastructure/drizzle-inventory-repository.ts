import { money } from "@cuadre/shared-kernel";
import { asc, eq, inArray } from "drizzle-orm";
import type { Db, DbTransaction } from "../../../db/client.ts";
import type { InventoryRepository } from "../application/inventory-repository.ts";
import { type StockBalance, zeroStockBalance } from "../domain/stock.ts";
import { stockBalancesTable, stockMovementsTable } from "./inventory.table.ts";

/** Postgres `numeric(15, 3)` text (`"12.345"`) ↔ thousandths. */
function toScaled(text: string): bigint {
  const [whole = "0", fraction = ""] = text.split(".");
  return BigInt(whole + fraction.padEnd(3, "0").slice(0, 3));
}

function fromScaled(scaled: bigint): string {
  const whole = scaled / 1000n;
  const fraction = (scaled % 1000n).toString().padStart(3, "0");
  return `${whole.toString()}.${fraction}`;
}

function toBalance(row: typeof stockBalancesTable.$inferSelect): StockBalance {
  const value = money(row.totalValueUsdMinor, "USD");
  if (!value.ok) throw new Error(`Stock balance ${row.productId} in the database breaks the rules`);
  return {
    productId: row.productId,
    onHandScaled: toScaled(row.onHand),
    totalValueUsd: value.value,
  };
}

export function createDrizzleInventoryRepository(db: Db): InventoryRepository {
  return {
    async lockBalances(productIds, tx) {
      await tx
        .insert(stockBalancesTable)
        .values(productIds.map((productId) => ({ productId })))
        .onConflictDoNothing();
      const rows = await tx
        .select()
        .from(stockBalancesTable)
        .where(inArray(stockBalancesTable.productId, [...productIds]))
        .orderBy(asc(stockBalancesTable.productId))
        .for("update");
      return new Map(rows.map((row) => [row.productId, toBalance(row)]));
    },

    async saveBalance(balance, tx) {
      await tx
        .update(stockBalancesTable)
        .set({
          onHand: fromScaled(balance.onHandScaled),
          totalValueUsdMinor: balance.totalValueUsd.minorUnits,
          updatedAt: new Date(),
        })
        .where(eq(stockBalancesTable.productId, balance.productId));
    },

    async insertMovements(rows, tx) {
      if (rows.length === 0) return;
      await tx.insert(stockMovementsTable).values(
        rows.map((row) => ({
          productId: row.productId,
          direction: row.direction,
          quantity: fromScaled(row.quantityScaled),
          totalCostUsdMinor: row.totalCostUsdMinor,
          referenceType: row.referenceType,
          referenceId: row.referenceId,
          documentDate: row.documentDate,
        })),
      );
    },

    async findBalance(productId, executor: DbTransaction | undefined) {
      const [row] = await (executor ?? db)
        .select()
        .from(stockBalancesTable)
        .where(eq(stockBalancesTable.productId, productId))
        .limit(1);
      return row === undefined ? zeroStockBalance(productId) : toBalance(row);
    },
  };
}
