import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["**/*.int.test.ts", "**/node_modules/**", "test/boundaries-fixtures/**"],
    setupFiles: ["./test/fast-check.setup.ts"],
  },
});
