// The only public API of the purchasing module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import { type CalendarDate, parseCalendarDate, todayCaracas } from "@cuadre/shared-kernel";
import type { Db } from "../../db/client.ts";
import type { CatalogModule } from "../catalog/index.ts";
import type { ExchangeRatesModule } from "../exchange-rates/index.ts";
import type { PartnersModule } from "../partners/index.ts";
import type { PurchasingLookups } from "./application/purchase-order-repository.ts";
import { createPurchaseOrderRoutes } from "./http/purchase-orders.routes.ts";
import { createDrizzlePurchaseOrderRepository } from "./infrastructure/drizzle-purchase-order-repository.ts";
import { seedPurchaseOrders } from "./infrastructure/seed-purchase-orders.ts";

export function createPurchasingModule({
  db,
  partners,
  catalog,
  exchangeRates,
  today = todayCaracas,
}: {
  db: Db;
  partners: Pick<PartnersModule, "findSupplierById" | "findSuppliersByIds" | "listAllSuppliers">;
  catalog: Pick<CatalogModule, "findProductsByIds" | "listAllProducts">;
  exchangeRates: Pick<ExchangeRatesModule, "lookupAndFreezeForDate">;
  today?: () => string;
}) {
  const repository = createDrizzlePurchaseOrderRepository(db);
  const lookups: PurchasingLookups = {
    findSupplierById: (id) => partners.findSupplierById(id),
    findSuppliersByIds: (ids) => partners.findSuppliersByIds(ids),
    findProductsByIds: (ids) => catalog.findProductsByIds(ids),
  };

  const currentToday = (): CalendarDate => {
    const parsed = parseCalendarDate(today());
    if (!parsed.ok) throw new Error("today() must return a YYYY-MM-DD calendar date");
    return parsed.value;
  };

  return {
    /** Mounted by the app under `/api`. */
    routes: createPurchaseOrderRoutes(db, repository, lookups, exchangeRates, currentToday),
    /** Loads the fictitious demo purchase orders (2 drafts + 1 issued); safe to run again. */
    seed: () =>
      seedPurchaseOrders(
        db,
        repository,
        lookups,
        exchangeRates,
        {
          listSuppliers: () => partners.listAllSuppliers(),
          listProducts: () => catalog.listAllProducts(),
        },
        currentToday(),
      ),
  };
}

export type PurchasingModule = ReturnType<typeof createPurchasingModule>;
