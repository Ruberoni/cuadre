import { sql } from "drizzle-orm";
import type { Db } from "../src/db/client.ts";

/** Schemas that are not module data: never truncated. */
const KEEP = ["pg_catalog", "information_schema", "drizzle", "public"];

/** Empties every table of every module schema, so tests do not depend on each other's rows. */
export async function resetDatabase(db: Db): Promise<void> {
  const tables = await db.execute<{ schemaname: string; tablename: string }>(
    sql`select schemaname, tablename from pg_tables
        where schemaname not in (${sql.join(
          KEEP.map((schema) => sql`${schema}`),
          sql`, `,
        )}) and schemaname not like 'pg_%'`,
  );
  if (tables.length === 0) return;
  const names = tables.map((table) => `"${table.schemaname}"."${table.tablename}"`).join(", ");
  await db.execute(sql.raw(`truncate table ${names} restart identity cascade`));
}
