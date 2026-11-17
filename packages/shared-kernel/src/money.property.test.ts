import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { unwrap } from "../test/unwrap.ts";
import {
  add,
  applyPercentage,
  type Currency,
  convert,
  money,
  parseRate,
  rateToString,
} from "./index.ts";
import { divideRoundHalfAwayFromZero } from "./rounding.ts";

// fc.integer stops at 2^31 - 1, so the large ranges come from bigInt.
const amountBetween = (min: number, max: number) =>
  fc.bigInt({ min: BigInt(min), max: BigInt(max) }).map(Number);
const currency = fc.constantFrom<Currency>("USD", "VES");

/** A rate written with 8 decimals and an integer part in [from, to]; never 0.00000000. */
const rateText = (from: number, to: number) =>
  fc
    .tuple(fc.integer({ min: from, max: to }), fc.integer({ min: 0, max: 99_999_999 }))
    .map(([int, frac]) => `${int}.${String(frac).padStart(8, "0")}`)
    .filter((text) => text !== "0.00000000");

describe("Money laws (ADR-005, ADR-014)", () => {
  it("addition is commutative and stays an integer number of minor units", () => {
    fc.assert(
      fc.property(
        amountBetween(-(10 ** 12), 10 ** 12),
        amountBetween(-(10 ** 12), 10 ** 12),
        currency,
        (a, b, code) => {
          const ab = unwrap(add(unwrap(money(a, code)), unwrap(money(b, code))));
          const ba = unwrap(add(unwrap(money(b, code)), unwrap(money(a, code))));
          expect(ab).toEqual(ba);
          expect(Number.isInteger(ab.minorUnits)).toBe(true);
        },
      ),
    );
  });

  it("addition is associative", () => {
    fc.assert(
      fc.property(
        amountBetween(-(10 ** 12), 10 ** 12),
        amountBetween(-(10 ** 12), 10 ** 12),
        amountBetween(-(10 ** 12), 10 ** 12),
        currency,
        (a, b, c, code) => {
          const [x, y, z] = [a, b, c].map((n) => unwrap(money(n, code)));
          if (x === undefined || y === undefined || z === undefined) throw new Error("unreachable");
          expect(unwrap(add(unwrap(add(x, y)), z))).toEqual(unwrap(add(x, unwrap(add(y, z)))));
        },
      ),
    );
  });

  it("USD → VES → USD at the same rate (≥ 1) differs from the original by at most 0.01 USD", () => {
    fc.assert(
      fc.property(amountBetween(-(10 ** 8), 10 ** 8), rateText(1, 1_000_000), (minor, text) => {
        const rate = unwrap(parseRate(text));
        const original = unwrap(money(minor, "USD"));
        const back = unwrap(convert(unwrap(convert(original, "VES", rate)), "USD", rate));
        expect(Math.abs(back.minorUnits - original.minorUnits)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("a percentage between 0 % and 100 % stays between zero and the original amount", () => {
    fc.assert(
      fc.property(
        amountBetween(0, 10 ** 15),
        fc.integer({ min: 0, max: 100 }),
        currency,
        (minor, percent, code) => {
          const result = unwrap(applyPercentage(unwrap(money(minor, code)), percent));
          expect(result.minorUnits).toBeGreaterThanOrEqual(0);
          expect(result.minorUnits).toBeLessThanOrEqual(minor);
        },
      ),
    );
  });
});

const abs = (x: bigint) => (x < 0n ? -x : x);

describe("rounding helper", () => {
  const dividend = fc.bigInt({ min: -(10n ** 18n), max: 10n ** 18n });
  const divisor = fc.bigInt({ min: 1n, max: 10n ** 9n });

  it("lands within half a unit of the exact quotient, and ties go away from zero", () => {
    fc.assert(
      fc.property(dividend, divisor, (n, d) => {
        const q = divideRoundHalfAwayFromZero(n, d);
        expect(abs((q * d - n) * 2n)).toBeLessThanOrEqual(d);
        // A tie (exactly half a unit away) goes to the quotient farther from zero.
        if (2n * abs(n % d) === d) expect(abs(q * d)).toBeGreaterThan(abs(n));
      }),
    );
  });

  it("is symmetric around zero", () => {
    fc.assert(
      fc.property(dividend, divisor, (n, d) => {
        expect(divideRoundHalfAwayFromZero(-n, d)).toBe(-divideRoundHalfAwayFromZero(n, d));
      }),
    );
  });
});

describe("Rate round trip", () => {
  it("parsing a rate and printing it gives it back with 8 decimals", () => {
    fc.assert(
      fc.property(rateText(0, 10 ** 12), (text) => {
        expect(rateToString(unwrap(parseRate(text)))).toBe(text);
      }),
    );
  });
});
