import { fileURLToPath } from "node:url";
import { loadConfig } from "../config.ts";
import { createCatalogModule } from "../modules/catalog/index.ts";
import { createDb } from "./client.ts";

/** Loads the fictitious demo data of every module. Safe to run more than once. */
export async function runSeed(url: string): Promise<{ products: number }> {
  const { db, close } = createDb(url);
  try {
    return { products: await createCatalogModule({ db }).seed() };
  } finally {
    await close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { products } = await runSeed(loadConfig().DATABASE_URL);
  console.log(`Seeded ${products} new products.`);
}
