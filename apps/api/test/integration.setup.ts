import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDatabaseIfMissing } from "../src/db/create-database.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { testDatabaseUrl } from "./test-database.ts";

// Vitest does not load `.env` into process.env; mirror what `tsx --env-file-if-exists` does.
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export async function setup() {
  const url = testDatabaseUrl();
  await createDatabaseIfMissing(url);
  await runMigrations(url);
}
