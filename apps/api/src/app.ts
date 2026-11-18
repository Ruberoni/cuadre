import { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "./db/client.ts";
import { healthRoute, isDatabaseUp } from "./health/health.route.ts";
import { openApiOptions, useErrorHandlers } from "./http/api-error.ts";
import { createCatalogModule } from "./modules/catalog/index.ts";

export function createApp({ db }: { db: Db }) {
  const app = new OpenAPIHono(openApiOptions);
  useErrorHandlers(app);

  app.openapi(healthRoute, async (c) => {
    const up = await isDatabaseUp(db);
    return up
      ? c.json({ status: "ok" as const, database: "up" as const }, 200)
      : c.json({ status: "error" as const, database: "down" as const }, 503);
  });

  app.route("/api", createCatalogModule({ db }).routes);

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Cuadre API", version: "0.0.0" },
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
