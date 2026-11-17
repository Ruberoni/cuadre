import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { scanForHardcodedValues } from "./scan-hardcoded-values.ts";

it("no token value is written by hand outside the generated tokens.css", () => {
  expect(scanForHardcodedValues(fileURLToPath(new URL("..", import.meta.url)))).toEqual([]);
});
