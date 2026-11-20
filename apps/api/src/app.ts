import { OpenAPIHono } from "@hono/zod-openapi";
import type { Auth } from "./auth/auth.ts";
import { requireSession } from "./auth/require-session.ts";
import type { Db } from "./db/client.ts";
import { healthRoute, isDatabaseUp } from "./health/health.route.ts";
import { openApiOptions, useErrorHandlers } from "./http/api-error.ts";
import { createCatalogModule } from "./modules/catalog/index.ts";

export function createApp({ db, auth }: { db: Db; auth: Auth }) {
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
  // Everything else under /api needs a session, unknown paths included (401 before 404).
  app.use("/api/*", requireSession(auth));

  app.route("/api", createCatalogModule({ db }).routes);

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: { title: "Cuadre API", version: "0.0.0" },
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
