import { DOCUMENT_STATUSES, type DocumentStatus } from "@cuadre/contracts";
import type { Currency } from "@cuadre/shared-kernel";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  integer,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Each module owns a Postgres schema of its own (ADR-004): `purchasing.*` in raw SQL. */
export const purchasingSchema = pgSchema("purchasing");

const CURRENCIES: readonly Currency[] = ["USD", "VES"];

const inList = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));

export const purchaseOrdersTable = purchasingSchema.table(
  "purchase_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Logical reference to `partners.partners.id` (no cross-schema FK per ADR-001/004). */
    supplierId: uuid("supplier_id").notNull(),
    currency: text("currency").$type<Currency>().notNull(),
    documentDate: date("document_date", { mode: "string" }).notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("DRAFT"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("purchase_orders_currency", sql`${table.currency} in (${inList(CURRENCIES)})`),
    check("purchase_orders_status", sql`${table.status} in (${inList(DOCUMENT_STATUSES)})`),
  ],
);

export const purchaseOrderLinesTable = purchasingSchema.table(
  "purchase_order_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrdersTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Logical reference to `catalog.products.id` (no cross-schema FK per ADR-001/004). */
    productId: uuid("product_id").notNull(),
    /** Exact quantity with up to 3 decimal places, never floating point (ADR-005). */
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    /** Integer minor units in the header's currency, excluding IVA (ADR-005). */
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("purchase_order_lines_order_position_unique").on(
      table.purchaseOrderId,
      table.position,
    ),
    check("purchase_order_lines_position_non_negative", sql`${table.position} >= 0`),
    check("purchase_order_lines_quantity_positive", sql`${table.quantity} > 0`),
    check("purchase_order_lines_unit_cost_positive", sql`${table.unitCostMinor} > 0`),
  ],
);
