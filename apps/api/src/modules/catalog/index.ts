// The only public API of the catalog module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import type { Db } from "../../db/client.ts";
import { createProductRoutes } from "./http/products.routes.ts";
import { createDrizzleProductRepository } from "./infrastructure/drizzle-product-repository.ts";
import { seedProducts } from "./infrastructure/seed-products.ts";

export function createCatalogModule({ db }: { db: Db }) {
  const products = createDrizzleProductRepository(db);
  return {
    /** Mounted by the app under `/api`. */
    routes: createProductRoutes(products),
    /** Loads the fictitious demo products; safe to run again. */
    seed: () => seedProducts(products),
  };
}

export type CatalogModule = ReturnType<typeof createCatalogModule>;
