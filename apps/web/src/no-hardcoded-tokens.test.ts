import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { scanForHardcodedValues } from "../test/scan-hardcoded-values.ts";

// tokens.css is the single source of truth for design tokens (ADR-012): code may use semantic
// classes (bg-primary) but never literal colors, in screens or components.
it("no token value is written by hand outside tokens.css", () => {
  expect(scanForHardcodedValues(fileURLToPath(new URL(".", import.meta.url)))).toEqual([]);
});
