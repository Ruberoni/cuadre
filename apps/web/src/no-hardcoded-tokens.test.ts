import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { scanForHardcodedValues } from "../test/scan-hardcoded-values.ts";

// The Design System owns the tokens (ADR-012): code may use semantic classes (bg-primary) but
// never literal colors, in screens or components. tokens.css is the only place values live.
it("no token value is written by hand outside the generated tokens.css", () => {
  expect(scanForHardcodedValues(fileURLToPath(new URL(".", import.meta.url)))).toEqual([]);
});
