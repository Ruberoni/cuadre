import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

// Tests that need real CSS (computed styles) run in Chromium. They are `test:e2e`, not
// `test:unit`, so the Stop hook stays inside its time budget. PLAYWRIGHT_CHANNEL=msedge (or
// chrome) runs against an installed browser where the Playwright CDN is unreachable.
const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    include: ["src/**/*.browser.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(channel ? { launchOptions: { channel } } : {}),
      instances: [{ browser: "chromium" }],
    },
  },
});
