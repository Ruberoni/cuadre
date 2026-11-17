import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { createDb } from "./db/client.ts";

const config = loadConfig();
const { db } = createDb(config.DATABASE_URL);
const app = createApp({ db });

serve({ fetch: app.fetch, port: config.API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
