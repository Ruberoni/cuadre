import { describe, expect, it } from "vitest";
import { divideRoundHalfAwayFromZero } from "./rounding.ts";

describe("divideRoundHalfAwayFromZero", () => {
  it.each([
    [4n, 2n, 2n],
    [5n, 2n, 3n], // 2.5 → 3
    [-5n, 2n, -3n], // -2.5 → -3 (away from zero, not -2)
    [3n, 2n, 2n], // 1.5 → 2
    [-1n, 2n, -1n], // -0.5 → -1
    [7n, 2n, 4n], // 3.5 → 4
    [1n, 3n, 0n], // 0.33 → 0
    [2n, 3n, 1n], // 0.66 → 1
    [-2n, 3n, -1n],
    [0n, 5n, 0n],
  ])("%s / %s → %s", (n, d, expected) => {
    expect(divideRoundHalfAwayFromZero(n, d)).toBe(expected);
  });
});
