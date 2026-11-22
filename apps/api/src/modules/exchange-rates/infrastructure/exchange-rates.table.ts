import { sql } from "drizzle-orm";
import { boolean, check, date, numeric, pgSchema, timestamp } from "drizzle-orm/pg-core";

/** Each module owns a Postgres schema of its own (ADR-004): `exchange_rates.rates` in raw SQL. */
export const exchangeRatesSchema = pgSchema("exchange_rates");

export const exchangeRatesTable = exchangeRatesSchema.table(
  "rates",
  {
    date: date("date", { mode: "string" }).primaryKey(),
    /** Exact decimal rate (VES per 1 USD), 8 decimal places, never floating point (ADR-005). */
    rate: numeric("rate", { precision: 20, scale: 8 }).notNull(),
    frozen: boolean("frozen").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("rates_rate_positive", sql`${table.rate} > 0`)],
);
