import { createRoute, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.ts";

const HEALTH_TIMEOUT_MS = 2000;

const healthSchema = z.object({
  status: z.enum(["ok", "error"]),
  database: z.enum(["up", "down"]),
});

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      description: "The API is up and the database is reachable.",
      content: { "application/json": { schema: healthSchema } },
    },
    503: {
      description: "The database is unreachable.",
      content: { "application/json": { schema: healthSchema } },
    },
  },
});

export async function isDatabaseUp(db: Db): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health check timed out")), HEALTH_TIMEOUT_MS);
  });
  try {
    await Promise.race([db.execute(sql`select 1`), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
