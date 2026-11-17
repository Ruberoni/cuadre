import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  // No flaky tests (ADR-014): never retry, locally or in CI.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Where the Playwright CDN is unreachable, run against an installed browser:
  // PLAYWRIGHT_CHANNEL=msedge (or chrome). CI uses the bundled Chromium.
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --strictPort --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Never reuse a server already on the port: it could be another worktree's build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
