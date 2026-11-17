import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "test/boundaries-fixtures/**"],
    setupFiles: ["./test/fast-check.setup.ts"],
  },
});
