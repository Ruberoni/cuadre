import postgres from "postgres";

const url = process.env.DATABASE_URL_E2E ?? "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_e2e";

/**
 * Empties every table of every module schema between tests. Kept: the migrations table, and the
 * seeded users with their password accounts (`auth.users`, `auth.accounts`), which the API's E2E
 * server seeds once; their sessions are emptied, so each test starts signed out.
 */
export async function resetDatabase(): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const tables = await sql<{ name: string }[]>`
      select format('%I.%I', schemaname, tablename) as name from pg_tables
      where schemaname not in ('pg_catalog', 'information_schema', 'drizzle', 'public')
        and (schemaname, tablename) not in (('auth', 'users'), ('auth', 'accounts'))`;
    if (tables.length > 0) {
      const names = tables.map((table) => table.name).join(", ");
      await sql.unsafe(`truncate table ${names} restart identity cascade`);
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** Ends every session on the server, as an expiry would. */
export async function forgetSessions(): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`delete from auth.sessions`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
