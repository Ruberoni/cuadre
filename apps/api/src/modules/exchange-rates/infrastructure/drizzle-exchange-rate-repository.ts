import { type CalendarDate, err, ok, type Rate, rateToString } from "@cuadre/shared-kernel";
import { and, count, desc, eq, inArray, lte } from "drizzle-orm";
import type { Db, DbExecutor, DbTransaction } from "../../../db/client.ts";
import { postgresError, UNIQUE_VIOLATION } from "../../../db/postgres-error.ts";
import type { ExchangeRateRepository } from "../application/exchange-rate-repository.ts";
import { type ExchangeRateRecord, reconstituteExchangeRate } from "../domain/exchange-rate.ts";
import { exchangeRatesTable } from "./exchange-rates.table.ts";

type ExchangeRateRow = typeof exchangeRatesTable.$inferSelect;

const DATE_PRIMARY_KEY_CONSTRAINT = "rates_pkey";

/**
 * Rows are rebuilt through domain rules on read so any row edited directly in Postgres that breaks
 * invariants fails loudly here instead of reaching the API.
 */
function toExchangeRate(row: ExchangeRateRow): ExchangeRateRecord {
  const record = reconstituteExchangeRate({
    date: row.date,
    rate: row.rate,
    frozen: row.frozen,
  });
  if (!record.ok) {
    throw new Error(`Exchange rate ${row.date} in the database breaks the exchange-rate rules`);
  }
  return record.value;
}

export function createDrizzleExchangeRateRepository(db: Db): ExchangeRateRepository {
  return {
    async insert(record: ExchangeRateRecord) {
      try {
        const [row] = await db
          .insert(exchangeRatesTable)
          .values({
            date: record.date,
            rate: rateToString(record.rate),
            frozen: record.frozen,
          })
          .returning();
        if (row === undefined) throw new Error("Insert returned no row");
        return ok(toExchangeRate(row));
      } catch (error) {
        const { code, constraint } = postgresError(error);
        if (code === UNIQUE_VIOLATION && constraint === DATE_PRIMARY_KEY_CONSTRAINT) {
          return err("RATE_ALREADY_EXISTS");
        }
        throw error;
      }
    },

    async updateRate(date: CalendarDate, rate: Rate) {
      const [row] = await db
        .update(exchangeRatesTable)
        .set({ rate: rateToString(rate), updatedAt: new Date() })
        .where(and(eq(exchangeRatesTable.date, date), eq(exchangeRatesTable.frozen, false)))
        .returning();
      if (row !== undefined) return ok(toExchangeRate(row));

      const [existing] = await db
        .select({ frozen: exchangeRatesTable.frozen })
        .from(exchangeRatesTable)
        .where(eq(exchangeRatesTable.date, date));
      return existing === undefined ? err("NOT_FOUND") : err("RATE_ALREADY_FROZEN");
    },

    async list({ page, pageSize }) {
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(exchangeRatesTable)
          .orderBy(desc(exchangeRatesTable.date))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: count() }).from(exchangeRatesTable),
      ]);
      return { items: rows.map(toExchangeRate), total: totals[0]?.total ?? 0 };
    },

    async findLatestOnOrBefore(date: CalendarDate, tx: DbExecutor = db) {
      const [row] = await tx
        .select()
        .from(exchangeRatesTable)
        .where(lte(exchangeRatesTable.date, date))
        .orderBy(desc(exchangeRatesTable.date))
        .limit(1);
      return row === undefined ? undefined : toExchangeRate(row);
    },

    async findAndFreezeLatestOnOrBefore(date: CalendarDate, tx: DbTransaction) {
      const latest = tx
        .select({ date: exchangeRatesTable.date })
        .from(exchangeRatesTable)
        .where(lte(exchangeRatesTable.date, date))
        .orderBy(desc(exchangeRatesTable.date))
        .limit(1);
      const [row] = await tx
        .update(exchangeRatesTable)
        .set({ frozen: true })
        .where(inArray(exchangeRatesTable.date, latest))
        .returning();
      return row === undefined ? undefined : toExchangeRate(row);
    },
  };
}
