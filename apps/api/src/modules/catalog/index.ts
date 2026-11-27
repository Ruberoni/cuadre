// The only public API of the catalog module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import type { Db, DbExecutor } from "../../db/client.ts";
import { createProductRoutes } from "./http/products.routes.ts";
import { createDrizzleProductRepository } from "./infrastructure/drizzle-product-repository.ts";
import { seedProducts } from "./infrastructure/seed-products.ts";

export type CatalogStockLookup = (
  productIds: readonly string[],
) => Promise<ReadonlyMap<string, string>>;

export function createCatalogModule({
  db,
  getOnHandByProductIds,
}: {
  db: Db;
  getOnHandByProductIds?: CatalogStockLookup;
}) {
  const products = createDrizzleProductRepository(db);
  return {
    /** Mounted by the app under `/api`. */
    routes: createProductRoutes(products, getOnHandByProductIds),
    /** Loads the fictitious demo products; safe to run again. */
    seed: () => seedProducts(products),
    /** Batch read-only product lookup by ids for other modules (ADR-001, ADR-008). */
    findProductsByIds: (ids: readonly string[], tx?: DbExecutor) => products.findByIds(ids, tx),
    /** Read-only list of products for seeding. */
    listAllProducts: async () =>
      (
        await products.list({
          search: undefined,
          sort: "sku",
          order: "asc",
          page: 1,
          pageSize: 100,
        })
      ).items,
  };
}

export type CatalogModule = ReturnType<typeof createCatalogModule>;
