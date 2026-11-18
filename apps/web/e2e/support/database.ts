import postgres from "postgres";

const url = process.env.DATABASE_URL_E2E ?? "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_e2e";

/** Empties every table of every module schema (the migrations table is kept), between tests. */
export async function resetDatabase(): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const tables = await sql<{ name: string }[]>`
      select format('%I.%I', schemaname, tablename) as name from pg_tables
      where schemaname not in ('pg_catalog', 'information_schema', 'drizzle', 'public')`;
    if (tables.length > 0) {
      const names = tables.map((table) => table.name).join(", ");
      await sql.unsafe(`truncate table ${names} restart identity cascade`);
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}
