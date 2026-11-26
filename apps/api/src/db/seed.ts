import { fileURLToPath } from "node:url";
import { createAuthFromConfig, seedUsers } from "../auth/index.ts";
import { type Config, loadConfig } from "../config.ts";
import { createCatalogModule } from "../modules/catalog/index.ts";
import { createExchangeRatesModule } from "../modules/exchange-rates/index.ts";
import { createPartnersModule } from "../modules/partners/index.ts";
import { createPurchasingModule } from "../modules/purchasing/index.ts";
import { createDb } from "./client.ts";

/**
 * Loads the seeded users (one per role) and, unless `usersOnly`, the fictitious demo data of every
 * module. Safe to run more than once.
 */
export async function runSeed(
  config: Config,
  { usersOnly = false }: { usersOnly?: boolean } = {},
): Promise<{
  users: number;
  products: number;
  exchangeRates: number;
  partners: number;
  purchaseOrders: number;
}> {
  // The seeded users have a published test password: never on a production database.
  if (config.NODE_ENV === "production") throw new Error("Refusing to seed in production.");
  const { db, close } = createDb(config.DATABASE_URL);
  try {
    const users = await seedUsers(db, createAuthFromConfig(db, config));
    const catalog = createCatalogModule({ db });
    const exchangeRatesModule = createExchangeRatesModule({ db });
    const partnersModule = createPartnersModule({ db });
    const purchasing = createPurchasingModule({
      db,
      partners: partnersModule,
      catalog,
      exchangeRates: exchangeRatesModule,
    });

    const products = usersOnly ? 0 : await catalog.seed();
    const exchangeRates = usersOnly ? 0 : await exchangeRatesModule.seed();
    const partners = usersOnly ? 0 : await partnersModule.seed();
    const purchaseOrders = usersOnly ? 0 : await purchasing.seed();
    return { users, products, exchangeRates, partners, purchaseOrders };
  } finally {
    await close();
  }
}

// Run as a script: `pnpm db:seed` (everything) or `pnpm db:seed:users` (`--users-only`).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const usersOnly = process.argv.includes("--users-only");
  const { users, products, exchangeRates, partners, purchaseOrders } = await runSeed(loadConfig(), {
    usersOnly,
  });
  console.log(
    `Seeded ${users} new users${usersOnly ? "" : `, ${products} new products, ${exchangeRates} new exchange rates, ${partners} new partners, and ${purchaseOrders} new purchase orders`}.`,
  );
}
