import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.browser.test.tsx"],
    setupFiles: ["./test/fast-check.setup.ts"],
  },
});
