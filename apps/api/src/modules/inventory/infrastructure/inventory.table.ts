import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Each module owns a Postgres schema of its own (ADR-004): `inventory.*` in raw SQL. */
export const inventorySchema = pgSchema("inventory");

export const STOCK_MOVEMENT_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type StockMovementDirection = (typeof STOCK_MOVEMENT_DIRECTIONS)[number];

/** One row per product: its on-hand quantity and total stock value; the average is derived (ADR-007). */
export const stockBalancesTable = inventorySchema.table(
  "stock_balances",
  {
    /** Logical reference to `catalog.products.id` (no cross-schema FK per ADR-001/004). */
    productId: uuid("product_id").primaryKey(),
    onHand: numeric("on_hand", { precision: 15, scale: 3 }).notNull().default("0"),
    /** USD cents, excluding IVA. */
    totalValueUsdMinor: bigint("total_value_usd_minor", { mode: "number" }).notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("stock_balances_on_hand_non_negative", sql`${table.onHand} >= 0`),
    check("stock_balances_value_non_negative", sql`${table.totalValueUsdMinor} >= 0`),
    check(
      "stock_balances_value_zero_when_empty",
      sql`${table.onHand} > 0 or ${table.totalValueUsdMinor} = 0`,
    ),
  ],
);

/** The stock ledger (kardex): one row per movement. */
export const stockMovementsTable = inventorySchema.table(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").notNull(),
    direction: text("direction").$type<StockMovementDirection>().notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    /** USD cents, excluding IVA. */
    totalCostUsdMinor: bigint("total_cost_usd_minor", { mode: "number" }).notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    documentDate: date("document_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stock_movements_product_date_idx").on(
      table.productId,
      table.documentDate,
      table.createdAt,
    ),
    check("stock_movements_direction", sql`${table.direction} in ('INBOUND', 'OUTBOUND')`),
    check("stock_movements_quantity_positive", sql`${table.quantity} > 0`),
    check("stock_movements_cost_non_negative", sql`${table.totalCostUsdMinor} >= 0`),
  ],
);
