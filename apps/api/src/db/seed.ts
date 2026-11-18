import { fileURLToPath } from "node:url";
import { createAuthFromConfig, seedUsers } from "../auth/index.ts";
import { type Config, loadConfig } from "../config.ts";
import { createCatalogModule } from "../modules/catalog/index.ts";
import { createDb } from "./client.ts";

/**
 * Loads the seeded users (one per role) and, unless `usersOnly`, the fictitious demo data of every
 * module. Safe to run more than once.
 */
export async function runSeed(
  config: Config,
  { usersOnly = false }: { usersOnly?: boolean } = {},
): Promise<{ users: number; products: number }> {
  const { db, close } = createDb(config.DATABASE_URL);
  try {
    const users = await seedUsers(db, createAuthFromConfig(db, config));
    const products = usersOnly ? 0 : await createCatalogModule({ db }).seed();
    return { users, products };
  } finally {
    await close();
  }
}

// Run as a script: `pnpm db:seed` (everything) or `pnpm db:seed:users` (`--users-only`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const usersOnly = process.argv.includes("--users-only");
  const { users, products } = await runSeed(loadConfig(), { usersOnly });
  console.log(`Seeded ${users} new users${usersOnly ? "" : ` and ${products} new products`}.`);
}
