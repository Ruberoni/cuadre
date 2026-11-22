// The only public API of the partners module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import type { Db } from "../../db/client.ts";
import { createSupplierRoutes } from "./http/suppliers.routes.ts";
import { createDrizzlePartnerRepository } from "./infrastructure/drizzle-partner-repository.ts";
import { seedPartners } from "./infrastructure/seed-partners.ts";

export function createPartnersModule({ db }: { db: Db }) {
  const partners = createDrizzlePartnerRepository(db);
  return {
    /** Mounted by the app under `/api`. */
    routes: createSupplierRoutes(partners),
    /** Loads the fictitious demo suppliers; safe to run again. */
    seed: () => seedPartners(partners),
  };
}

export type PartnersModule = ReturnType<typeof createPartnersModule>;
