import { defineConfig } from "drizzle-kit";

// Each module declares its tables in `src/modules/<module>/infrastructure/*.table.ts` and owns a
// Postgres schema of its own (ADR-004); auth is cross-cutting (`src/auth`) but keeps a schema too.
export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/modules/*/infrastructure/*.table.ts", "./src/auth/*.table.ts"],
  schemaFilter: ["catalog", "exchange_rates", "partners", "purchasing", "inventory", "auth"],
  out: "./drizzle",
});
