import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export function createDb(url: string) {
  const client = postgres(url, { connect_timeout: 2, max: 5 });
  const db = drizzle(client);
  return { db, close: () => client.end({ timeout: 1 }) };
}

export type Db = ReturnType<typeof createDb>["db"];
