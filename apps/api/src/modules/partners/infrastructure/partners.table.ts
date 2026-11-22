import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_EMAIL_MAX_LENGTH,
  PARTNER_NAME_MAX_LENGTH,
  PARTNER_PHONE_MAX_LENGTH,
} from "@cuadre/contracts";
import { sql } from "drizzle-orm";
import { boolean, check, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Each module owns a Postgres schema of its own (ADR-004): `partners.partners` in raw SQL. */
export const partnersSchema = pgSchema("partners");

export const partnersTable = partnersSchema.table(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stored normalised as `L-NNNNNNNN-C`; unique across all partners. */
    rif: text("rif").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    isSupplier: boolean("is_supplier").notNull().default(false),
    isCustomer: boolean("is_customer").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("partners_rif_format", sql`${table.rif} ~ '^[VEJPG]-[0-9]{8}-[0-9]$'`),
    check(
      "partners_name_length",
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(PARTNER_NAME_MAX_LENGTH))}`,
    ),
    check(
      "partners_phone_length",
      sql`${table.phone} is null or char_length(${table.phone}) between 1 and ${sql.raw(String(PARTNER_PHONE_MAX_LENGTH))}`,
    ),
    check(
      "partners_email_length",
      sql`${table.email} is null or char_length(${table.email}) between 1 and ${sql.raw(String(PARTNER_EMAIL_MAX_LENGTH))}`,
    ),
    check(
      "partners_address_length",
      sql`${table.address} is null or char_length(${table.address}) between 1 and ${sql.raw(String(PARTNER_ADDRESS_MAX_LENGTH))}`,
    ),
    check("partners_has_role", sql`${table.isSupplier} or ${table.isCustomer}`),
  ],
);
