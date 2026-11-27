// The only public API of the purchasing module (ADR-001): other code imports from here, never from
// domain/, application/, infrastructure/ or http/.
import { type CalendarDate, parseCalendarDate, todayCaracas } from "@cuadre/shared-kernel";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "../../db/client.ts";
import { openApiOptions } from "../../http/api-error.ts";
import type { CatalogModule } from "../catalog/index.ts";
import type { ExchangeRatesModule } from "../exchange-rates/index.ts";
import type { InventoryModule } from "../inventory/index.ts";
import type { PartnersModule } from "../partners/index.ts";
import type { PurchasingLookups } from "./application/purchase-order-repository.ts";
import { createGoodsReceiptRoutes } from "./http/goods-receipts.routes.ts";
import { createPurchaseOrderRoutes } from "./http/purchase-orders.routes.ts";
import { createDrizzleGoodsReceiptRepository } from "./infrastructure/drizzle-goods-receipt-repository.ts";
import { createDrizzlePurchaseOrderRepository } from "./infrastructure/drizzle-purchase-order-repository.ts";
import { seedGoodsReceipts } from "./infrastructure/seed-goods-receipts.ts";
import { seedPurchaseOrders } from "./infrastructure/seed-purchase-orders.ts";

export function createPurchasingModule({
  db,
  partners,
  catalog,
  exchangeRates,
  inventory,
  today = todayCaracas,
}: {
  db: Db;
  partners: Pick<PartnersModule, "findSupplierById" | "findSuppliersByIds" | "listAllSuppliers">;
  catalog: Pick<CatalogModule, "findProductsByIds" | "listAllProducts">;
  exchangeRates: Pick<ExchangeRatesModule, "lookupAndFreezeForDate">;
  inventory: Pick<InventoryModule, "recordInboundMovements">;
  today?: () => string;
}) {
  const repository = createDrizzlePurchaseOrderRepository(db);
  const goodsReceiptRepository = createDrizzleGoodsReceiptRepository(db);
  const lookups: PurchasingLookups = {
    findSupplierById: (id) => partners.findSupplierById(id),
    findSuppliersByIds: (ids) => partners.findSuppliersByIds(ids),
    findProductsByIds: (ids, tx) => catalog.findProductsByIds(ids, tx),
  };
  const goodsReceiptDeps = { repository: goodsReceiptRepository, orders: repository, lookups };

  const currentToday = (): CalendarDate => {
    const parsed = parseCalendarDate(today());
    if (!parsed.ok) throw new Error("today() must return a YYYY-MM-DD calendar date");
    return parsed.value;
  };

  const routes = new OpenAPIHono(openApiOptions);
  routes.route(
    "/",
    createPurchaseOrderRoutes(db, repository, lookups, exchangeRates, currentToday),
  );
  routes.route(
    "/",
    createGoodsReceiptRoutes(db, goodsReceiptDeps, exchangeRates, inventory, currentToday),
  );

  const sources = {
    listSuppliers: () => partners.listAllSuppliers(),
    listProducts: () => catalog.listAllProducts(),
  };

  return {
    /** Mounted by the app under `/api`. */
    routes,
    /**
     * Loads the fictitious demo purchase orders (2 drafts + 2 issued, one of them received through
     * an issued goods receipt); safe to run again.
     */
    seed: async () => {
      const purchaseOrders = await seedPurchaseOrders(
        db,
        repository,
        lookups,
        exchangeRates,
        sources,
        currentToday(),
      );
      const goodsReceipts = await seedGoodsReceipts(
        { ...goodsReceiptDeps, db, exchangeRates, inventory, orderRepository: repository },
        sources,
        currentToday(),
      );
      return { purchaseOrders: purchaseOrders + goodsReceipts, goodsReceipts };
    },
  };
}
