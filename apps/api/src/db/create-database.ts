import postgres from "postgres";

// A database name is interpolated into DDL (it cannot be a parameter): only plain identifiers.
const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/;

const CONNECT_DELAY_MS = 1000;
// Postgres error codes.
const INVALID_CATALOG_NAME = "3D000"; // the database does not exist
const DUPLICATE_DATABASE = "42P04";

const codeOf = (error: unknown) => (error as { code?: string }).code;

/** The database name of a Postgres URL, checked to be a plain identifier. */
export function databaseNameOf(url: string): string {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!DATABASE_NAME.test(name)) {
    throw new Error(`Refusing to manage database "${name}": not a plain lowercase identifier.`);
  }
  return name;
}

/** Connects, retrying `attempts` times a second apart (Postgres may still be starting). */
async function connect(url: string, attempts: number) {
  for (let attempt = 1; ; attempt++) {
    const sql = postgres(url, { max: 1, connect_timeout: 3, onnotice: () => {} });
    try {
      await sql`select 1`;
      return sql;
    } catch (error) {
      await sql.end({ timeout: 1 });
      if (codeOf(error) === INVALID_CATALOG_NAME || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS));
    }
  }
}

/** The same server's `postgres` database, from which databases are created and dropped. */
function adminUrlOf(url: string): string {
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  return adminUrl.toString();
}

async function create(sql: postgres.Sql, name: string): Promise<void> {
  try {
    await sql.unsafe(`CREATE DATABASE ${name}`);
  } catch (error) {
    // Another process created it in between.
    if (codeOf(error) !== DUPLICATE_DATABASE) throw error;
  }
}

/**
 * Creates the database of `url` only when connecting to it says it does not exist, so a worktree's
 * own databases appear on first use and an existing one is never touched (nor its name checked).
 */
export async function createDatabaseIfMissing(
  url: string,
  { attempts = 1 }: { attempts?: number } = {},
): Promise<void> {
  try {
    const sql = await connect(url, attempts);
    await sql.end({ timeout: 1 });
    return;
  } catch (error) {
    if (codeOf(error) !== INVALID_CATALOG_NAME) throw error;
  }
  const name = databaseNameOf(url);
  const sql = await connect(adminUrlOf(url), 1);
  try {
    await create(sql, name);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** Drops the database of `url` (closing its connections) and creates it empty. */
export async function recreateDatabase(
  url: string,
  { attempts = 1 }: { attempts?: number } = {},
): Promise<void> {
  const name = databaseNameOf(url);
  const sql = await connect(adminUrlOf(url), attempts);
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await create(sql, name);
  } finally {
    await sql.end({ timeout: 1 });
  }
}
