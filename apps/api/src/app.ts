import { OpenAPIHono } from "@hono/zod-openapi";
import type { Auth } from "./auth/auth.ts";
import { requireSession } from "./auth/require-session.ts";
import { requireRoleDeclaration } from "./auth/roles.ts";
import type { Db } from "./db/client.ts";
import { healthRoute, isDatabaseUp } from "./health/health.route.ts";
import { openApiOptions, useErrorHandlers } from "./http/api-error.ts";
import { createCatalogModule } from "./modules/catalog/index.ts";
import { createExchangeRatesModule } from "./modules/exchange-rates/index.ts";
import { createInventoryModule } from "./modules/inventory/index.ts";
import { createPartnersModule } from "./modules/partners/index.ts";
import { createPurchasingModule } from "./modules/purchasing/index.ts";

export function createApp({ db, auth, today }: { db: Db; auth: Auth; today?: () => string }) {
  const app = new OpenAPIHono(openApiOptions);
  useErrorHandlers(app);

  app.openapi(healthRoute, async (c) => {
    const up = await isDatabaseUp(db);
    return up
      ? c.json({ status: "ok" as const, database: "up" as const }, 200)
      : c.json({ status: "error" as const, database: "down" as const }, 503);
  });

  // Better Auth answers its own routes (sign-in, sign-out, get-session) with its own bodies. It is
  // registered first and never calls `next`, so the session gate below never runs for them.
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  // Everything else under /api needs a session, unknown paths included (401 before 404), and every
  // endpoint must declare its roles with `allowRoles`: one that does not answers 403 to everyone.
  app.use("/api/*", requireSession(auth), requireRoleDeclaration());

  const inventory = createInventoryModule({ db });
  const catalog = createCatalogModule({
    db,
    getOnHandByProductIds: (ids) => inventory.getOnHandByProductIds(ids),
  });
  const partners = createPartnersModule({ db });
  const exchangeRates = createExchangeRatesModule({
    db,
    ...(today === undefined ? {} : { today }),
  });
  const purchasing = createPurchasingModule({
    db,
    partners,
    catalog,
    exchangeRates,
    inventory,
    ...(today === undefined ? {} : { today }),
  });
  const inventoryRoutes = inventory.createRoutes({
    findProductById: async (id) => (await catalog.findProductsByIds([id])).get(id) ?? null,
    findGoodsReceiptInvoiceNumbersByIds: (ids) =>
      purchasing.findGoodsReceiptInvoiceNumbersByIds(ids),
  });

  app.route("/api", catalog.routes);
  app.route("/api", exchangeRates.routes);
  app.route("/api", inventoryRoutes);
  app.route("/api", partners.routes);
  app.route("/api", purchasing.routes);

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Cuadre API", version: "0.0.0" },
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
