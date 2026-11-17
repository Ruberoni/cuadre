import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { runMigrations } from "./migrate.ts";

const DEFAULT_E2E_DATABASE_URL = "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_e2e";

/** The end-to-end database: separate from dev and integration data, rebuilt by `pnpm verify`. */
export function e2eDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.DATABASE_URL_E2E ?? DEFAULT_E2E_DATABASE_URL;
}

// A database name is interpolated into DDL (it cannot be a parameter), and DROP must never be able
// to reach the dev or integration databases: only names ending in `_e2e` are accepted.
const E2E_DATABASE_NAME = /^[a-z][a-z0-9_]*_e2e$/;

const CONNECT_ATTEMPTS = 15;
const CONNECT_DELAY_MS = 1000;

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

/** Creates the e2e database if missing (dropping it first with `fresh`) and migrates it. */
export async function prepareE2eDatabase(url: string, options: { fresh: boolean }): Promise<void> {
  const name = decodeURIComponent(new URL(url).pathname.slice(1));
  if (!E2E_DATABASE_NAME.test(name)) {
    throw new Error(`Refusing to manage database "${name}": e2e database names end in "_e2e".`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const sql = await connectWhenReady(adminUrl.toString());
  try {
    if (options.fresh) await sql.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    const existing = await sql`select 1 from pg_database where datname = ${name}`;
    if (existing.length === 0) await sql.unsafe(`CREATE DATABASE ${name}`);
  } finally {
    await sql.end({ timeout: 1 });
  }

  await runMigrations(url);
}

// Run as a script: `pnpm db:e2e:prepare [--fresh]`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await prepareE2eDatabase(e2eDatabaseUrl(), { fresh: process.argv.includes("--fresh") });
  console.log("E2E database ready.");
}
