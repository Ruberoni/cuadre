import { fileURLToPath } from "node:url";
import { createAuthFromConfig, seedUsers } from "../auth/index.ts";
import { type Config, loadConfig } from "../config.ts";
import { createCatalogModule } from "../modules/catalog/index.ts";
import { createDb } from "./client.ts";

/** Loads the seeded users (one per role). Safe to run more than once. */
export async function runUserSeed(config: Config): Promise<number> {
  const { db, close } = createDb(config.DATABASE_URL);
  try {
    return await seedUsers(db, createAuthFromConfig(db, config));
  } finally {
    await close();
  }
}

/** Loads the seeded users and the fictitious demo data of every module. Safe to run more than once. */
export async function runSeed(config: Config): Promise<{ users: number; products: number }> {
  const users = await runUserSeed(config);
  const { db, close } = createDb(config.DATABASE_URL);
  try {
    return { users, products: await createCatalogModule({ db }).seed() };
  } finally {
    await close();
  }
}

// Run as a script: `pnpm db:seed` (everything) or `pnpm db:seed:users` (`--users-only`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadConfig();
  if (process.argv.includes("--users-only")) {
    console.log(`Seeded ${await runUserSeed(config)} new users.`);
  } else {
    const { users, products } = await runSeed(config);
    console.log(`Seeded ${users} new users and ${products} new products.`);
  }
}
