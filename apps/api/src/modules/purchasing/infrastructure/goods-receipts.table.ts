import { DOCUMENT_STATUSES, type DocumentStatus } from "@cuadre/contracts";
import type { Currency } from "@cuadre/shared-kernel";
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  purchaseOrderLinesTable,
  purchaseOrdersTable,
  purchasingSchema,
} from "./purchase-orders.table.ts";

const inList = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));

/** One goods receipt per purchase order (1:1), enforced by the unique index on `purchase_order_id`. */
export const goodsReceiptsTable = purchasingSchema.table(
  "goods_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrdersTable.id),
    /** Logical reference to `partners.partners.id` (no cross-schema FK per ADR-001/004). */
    supplierId: uuid("supplier_id").notNull(),
    currency: text("currency").$type<Currency>().notNull(),
    documentDate: date("document_date", { mode: "string" }).notNull(),
    supplierInvoiceNumber: text("supplier_invoice_number").notNull(),
    controlNumber: text("control_number").notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("DRAFT"),
    /** Exact BCV rate frozen at issue time (ADR-005); null while Draft. */
    frozenRate: numeric("frozen_rate", { precision: 20, scale: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("goods_receipts_purchase_order_unique").on(table.purchaseOrderId),
    check("goods_receipts_currency", sql`${table.currency} in ('USD', 'VES')`),
    check("goods_receipts_status", sql`${table.status} in (${inList(DOCUMENT_STATUSES)})`),
    check(
      "goods_receipts_frozen_rate_matches_status",
      sql`(${table.status} = 'DRAFT' and ${table.frozenRate} is null) or (${table.status} = 'ISSUED' and ${table.frozenRate} is not null and ${table.frozenRate} > 0)`,
    ),
    check(
      "goods_receipts_supplier_invoice_number_not_blank",
      sql`length(trim(${table.supplierInvoiceNumber})) > 0`,
    ),
    check("goods_receipts_control_number_not_blank", sql`length(trim(${table.controlNumber})) > 0`),
  ],
);

export const goodsReceiptLinesTable = purchasingSchema.table(
  "goods_receipt_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceiptsTable.id, { onDelete: "cascade" }),
    purchaseOrderLineId: uuid("purchase_order_line_id")
      .notNull()
      .references(() => purchaseOrderLinesTable.id),
    position: integer("position").notNull(),
    /** Logical reference to `catalog.products.id` (no cross-schema FK per ADR-001/004). */
    productId: uuid("product_id").notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    /** Integer minor units in the header's currency, excluding IVA (ADR-005). */
    unitCostMinor: bigint("unit_cost_minor", { mode: "number" }).notNull(),
  },
  (table) => [
    uniqueIndex("goods_receipt_lines_receipt_position_unique").on(
      table.goodsReceiptId,
      table.position,
    ),
    uniqueIndex("goods_receipt_lines_receipt_order_line_unique").on(
      table.goodsReceiptId,
      table.purchaseOrderLineId,
    ),
    check("goods_receipt_lines_position_non_negative", sql`${table.position} >= 0`),
    check("goods_receipt_lines_quantity_positive", sql`${table.quantity} > 0`),
    check("goods_receipt_lines_unit_cost_positive", sql`${table.unitCostMinor} > 0`),
  ],
);
