import { defineConfig } from "drizzle-kit";

// Each module declares its tables in `src/modules/<module>/infrastructure/*.table.ts` (ADR-004).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/infrastructure/*.table.ts",
  out: "./drizzle",
});
