import { TAX_RATES, type TaxRate, UNITS_OF_MEASURE, type UnitOfMeasure } from "@cuadre/contracts";
import { sql } from "drizzle-orm";
import { bigint, check, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Each module owns a Postgres schema of its own (ADR-004): `catalog.products` in raw SQL. */
export const catalogSchema = pgSchema("catalog");

const inList = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value}'`).join(", "));

export const productsTable = catalogSchema.table(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored uppercase and normalised; unique. */
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(),
    unitOfMeasure: text("unit_of_measure").$type<UnitOfMeasure>().notNull(),
    /** Integer minor units (ADR-005), never a float. */
    salePriceMinor: bigint("sale_price_minor", { mode: "number" }).notNull(),
    salePriceCurrency: text("sale_price_currency").$type<"USD">().notNull().default("USD"),
    taxRate: text("tax_rate").$type<TaxRate>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("products_sku_format", sql`${table.sku} ~ '^[A-Z0-9-]{1,20}$'`),
    check("products_name_length", sql`char_length(${table.name}) between 1 and 120`),
    check("products_unit_of_measure", sql`${table.unitOfMeasure} in (${inList(UNITS_OF_MEASURE)})`),
    check("products_tax_rate", sql`${table.taxRate} in (${inList(TAX_RATES)})`),
    check("products_sale_price_positive", sql`${table.salePriceMinor} > 0`),
    check("products_sale_price_usd", sql`${table.salePriceCurrency} = 'USD'`),
  ],
);
