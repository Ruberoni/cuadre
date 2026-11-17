import { defineConfig, devices } from "@playwright/test";

const API_PORT = Number(process.env.E2E_API_PORT ?? 3100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4173);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
// A database of its own (rebuilt by `pnpm verify`), never the dev one.
const E2E_DATABASE_URL =
  process.env.DATABASE_URL_E2E ?? "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_e2e";

export default defineConfig({
  testDir: "./e2e",
  // No flaky tests (ADR-014): never retry, locally or in CI.
  retries: 0,
  // One shared database: tests run one at a time.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // `smoke` is what `pnpm verify` runs; `acceptance` is one test per UI acceptance criterion.
  // Where the Playwright CDN is unreachable, run against an installed browser:
  // PLAYWRIGHT_CHANNEL=msedge (or chrome). CI uses the bundled Chromium.
  projects: ["smoke", "acceptance"].map((name) => ({
    name,
    testMatch: name === "smoke" ? "smoke.spec.ts" : "products/**/*.spec.ts",
    use: {
      ...devices["Desktop Chrome"],
      ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    },
  })),
  // Playwright starts the web servers before anything else, so the API prepares its own database
  // (create if missing, migrate) as part of its start command.
  webServer: [
    {
      command: "pnpm --filter @cuadre/api db:e2e:prepare && pnpm --filter @cuadre/api start",
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        DATABASE_URL_E2E: E2E_DATABASE_URL,
        API_PORT: String(API_PORT),
      },
      url: `${API_URL}/health`,
      // Never reuse a server already on the port: it could be another worktree's.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite build && pnpm exec vite preview --strictPort --host 127.0.0.1 --port ${WEB_PORT}`,
      env: { API_URL },
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
