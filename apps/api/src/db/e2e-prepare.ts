import { fileURLToPath } from "node:url";
import { defaultDatabaseUrl } from "@cuadre/dev-env";
import { createDatabaseIfMissing, databaseNameOf, recreateDatabase } from "./create-database.ts";
import { runMigrations } from "./migrate.ts";

/**
 * The end-to-end database: separate from dev and integration data, rebuilt by `pnpm verify`.
 * `cuadre_e2e` in the main checkout, `cuadre_wt_<worktree>__e2e` in a worktree.
 */
export function e2eDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  return env.DATABASE_URL_E2E ?? defaultDatabaseUrl("e2e");
}

/** Creates the e2e database if missing (dropping it first with `fresh`) and migrates it. */
export async function prepareE2eDatabase(url: string, options: { fresh: boolean }): Promise<void> {
  // DROP must never be able to reach the dev or integration databases: only names ending in `_e2e`.
  const name = databaseNameOf(url);
  if (!name.endsWith("_e2e")) {
    throw new Error(`Refusing to manage database "${name}": e2e database names end in "_e2e".`);
  }
  // `verify` may have just started Postgres: wait for it up to 15 s.
  if (options.fresh) await recreateDatabase(url, { attempts: 15 });
  else await createDatabaseIfMissing(url, { attempts: 15 });
  await runMigrations(url);
}

// Run as a script: `pnpm db:e2e:prepare [--fresh]`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await prepareE2eDatabase(e2eDatabaseUrl(), { fresh: process.argv.includes("--fresh") });
  console.log("E2E database ready.");
}
