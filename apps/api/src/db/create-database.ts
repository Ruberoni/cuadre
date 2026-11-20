import postgres from "postgres";

// A database name is interpolated into DDL (it cannot be a parameter): only plain identifiers.
const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

const CONNECT_ATTEMPTS = 15;
const CONNECT_DELAY_MS = 1000;

/** The database name of a Postgres URL, checked to be a plain identifier. */
export function databaseNameOf(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!DATABASE_NAME.test(name)) {
    throw new Error(`Refusing to manage database "${name}": not a plain lowercase identifier.`);
  }
  return name;
}

async function connectWhenReady(adminUrl: string) {
  for (let attempt = 1; ; attempt++) {
    const sql = postgres(adminUrl, { max: 1, connect_timeout: 3, onnotice: () => {} });
    try {
      await sql`select 1`;
      return sql;
    } catch (error) {
      await sql.end({ timeout: 1 });
      if (attempt >= CONNECT_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS));
    }
  }
}

/**
 * Creates the database of `url` when it does not exist yet (dropping it first with `fresh`), so a
 * worktree's own databases appear on first use. Connects through the server's `postgres` database.
 */
export async function createDatabaseIfMissing(
  url: string,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<void> {
  const name = databaseNameOf(url);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const sql = await connectWhenReady(adminUrl.toString());
  try {
    if (fresh) await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    const existing = await sql`select 1 from pg_database where datname = ${name}`;
    if (existing.length > 0) return;
    try {
      await sql.unsafe(`CREATE DATABASE ${name}`);
    } catch (error) {
      // Another process created it in between (42P04: duplicate_database).
      if ((error as { code?: string }).code !== "42P04") throw error;
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}
