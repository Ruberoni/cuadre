import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { clamp } from "./clamp.ts";

describe("clamp (sample property test)", () => {
  it("always returns a value within [min, max]", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (value, a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        const result = clamp(value, min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
      }),
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), fc.integer(), (value, a, b) => {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        expect(clamp(clamp(value, min, max), min, max)).toBe(clamp(value, min, max));
      }),
    );
  });
});
