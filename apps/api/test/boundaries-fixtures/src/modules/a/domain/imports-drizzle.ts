// Violates domain-purity: domain imports Drizzle.
import { sql } from "drizzle-orm";

export const query = sql`select 1`;
