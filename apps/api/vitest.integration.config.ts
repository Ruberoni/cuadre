import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["./test/integration.setup.ts"],
    setupFiles: ["./test/fast-check.setup.ts"],
    fileParallelism: false,
  },
});
