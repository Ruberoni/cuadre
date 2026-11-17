import { defineConfig } from "drizzle-kit";

// Each module declares its tables in `src/modules/<module>/infrastructure/*.table.ts` and owns a
// Postgres schema of its own (ADR-004).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/infrastructure/*.table.ts",
  schemaFilter: ["catalog"],
  out: "./drizzle",
});
