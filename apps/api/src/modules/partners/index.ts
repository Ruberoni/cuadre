// The only public API of the partners module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Db, DbExecutor } from "../../db/client.ts";
import { openApiOptions } from "../../http/api-error.ts";
import { registerCustomerRoutes } from "./http/customers.routes.ts";
import { registerSupplierRoutes } from "./http/suppliers.routes.ts";
import { createDrizzlePartnerRepository } from "./infrastructure/drizzle-partner-repository.ts";
import { seedPartners } from "./infrastructure/seed-partners.ts";

export function createPartnersModule({ db }: { db: Db }) {
  const partners = createDrizzlePartnerRepository(db);
  const routes = new OpenAPIHono(openApiOptions);
  registerSupplierRoutes(routes, partners);
  registerCustomerRoutes(routes, partners);

  return {
    /** Mounted by the app under `/api`. */
    routes,
    /** Loads the fictitious demo suppliers and customers; safe to run again. */
    seed: () => seedPartners(partners),
    /** Read-only supplier lookup by id for other modules (ADR-001, ADR-008). */
    findSupplierById: (id: string, tx?: DbExecutor) => partners.findSupplierById(id, tx),
    /** Batch read-only supplier lookup by ids for other modules (ADR-001, ADR-008). */
    findSuppliersByIds: (ids: readonly string[], tx?: DbExecutor) =>
      partners.findSuppliersByIds(ids, tx),
    /** Read-only list of suppliers for seeding. */
    listAllSuppliers: async () =>
      (
        await partners.listByRole("supplier", {
          sort: "name",
          order: "asc",
          page: 1,
          pageSize: 100,
        })
      ).items,
  };
}

export type PartnersModule = ReturnType<typeof createPartnersModule>;
