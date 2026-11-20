import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { createAuthFromConfig } from "./auth/index.ts";
import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";

const config = loadConfig();
const { db } = createDb(config.DATABASE_URL);
const app = createApp({ db, auth: createAuthFromConfig(db, config) });

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
