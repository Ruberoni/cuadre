import { fileURLToPath } from "node:url";
import { scanForHardcodedValues } from "@cuadre/ui/lib/scan-hardcoded-values";
import { expect, it } from "vitest";

// Tokens come from packages/ui; the web app may use semantic classes (bg-primary) but never
// literal colors (ADR-012). This copy runs over apps/web/src so its Turborepo cache key covers it.
it("no token value is written by hand in apps/web", () => {
  expect(scanForHardcodedValues(fileURLToPath(new URL(".", import.meta.url)))).toEqual([]);
});
