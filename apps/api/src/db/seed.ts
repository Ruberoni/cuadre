import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { loadConfig } from "../config.ts";
import { createDb } from "./client.ts";

/** Seed data arrives with the first module; for now this only proves the connection works. */
export async function runSeed(url: string): Promise<void> {
  const { db, close } = createDb(url);
  try {
    await db.execute(sql`select 1`);
  } finally {
    await close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runSeed(loadConfig().DATABASE_URL);
  console.log("Nothing to seed yet.");
}
