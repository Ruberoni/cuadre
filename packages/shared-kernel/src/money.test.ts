import { describe, expect, it } from "vitest";
import { unwrap } from "../test/unwrap.ts";
import {
  add,
  applyPercentage,
  convert,
  MAX_MINOR_UNITS,
  type Money,
  money,
  parseRate,
} from "./index.ts";

const usd = (minorUnits: number) => unwrap(money(minorUnits, "USD"));
const ves = (minorUnits: number) => unwrap(money(minorUnits, "VES"));
const rate = (text: string) => unwrap(parseRate(text));
const plain = (m: Money) => ({ minorUnits: m.minorUnits, currency: m.currency });

describe("money", () => {
  it("builds an amount of whole minor units", () => {
    expect(plain(usd(145))).toEqual({ minorUnits: 145, currency: "USD" });
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects %s as INVALID_AMOUNT",
    (n) => {
      expect(money(n, "USD")).toEqual({ ok: false, error: "INVALID_AMOUNT" });
    },
  );

  it.each([MAX_MINOR_UNITS + 1, -(MAX_MINOR_UNITS + 1), 2 ** 53])(
    "rejects %s as AMOUNT_OUT_OF_RANGE",
    (n) => {
      expect(money(n, "VES")).toEqual({ ok: false, error: "AMOUNT_OUT_OF_RANGE" });
    },
  );

  it("accepts the limits and negative amounts", () => {
    expect(usd(MAX_MINOR_UNITS).minorUnits).toBe(MAX_MINOR_UNITS);
    expect(usd(-MAX_MINOR_UNITS).minorUnits).toBe(-MAX_MINOR_UNITS);
    expect(usd(-150).minorUnits).toBe(-150);
  });

  it("normalizes -0 to 0", () => {
    expect(Object.is(usd(-0).minorUnits, 0)).toBe(true);
  });
});

describe("add", () => {
  it("1.45 USD + 2.30 USD = 3.75 USD", () => {
    expect(plain(unwrap(add(usd(145), usd(230))))).toEqual({ minorUnits: 375, currency: "USD" });
  });

  it("1.45 USD + 1.00 VES is a CURRENCY_MISMATCH", () => {
    expect(add(usd(145), ves(100))).toEqual({ ok: false, error: "CURRENCY_MISMATCH" });
  });

  it("fails instead of losing precision past the limit", () => {
    expect(add(usd(MAX_MINOR_UNITS), usd(1))).toEqual({ ok: false, error: "AMOUNT_OUT_OF_RANGE" });
  });
});

describe("convert", () => {
  it("10.00 USD at 36.51230000 = 365.12 VES (365.1230 rounded)", () => {
    expect(plain(unwrap(convert(usd(1000), "VES", rate("36.5123"))))).toEqual({
      minorUnits: 36512,
      currency: "VES",
    });
  });

  it("1.45 USD at 36.51230000 = 52.94 VES (52.942835 rounded)", () => {
    expect(unwrap(convert(usd(145), "VES", rate("36.5123"))).minorUnits).toBe(5294);
  });

  it("365.12 VES at 36.51230000 = 10.00 USD (9.99992 rounded)", () => {
    expect(plain(unwrap(convert(ves(36512), "USD", rate("36.5123"))))).toEqual({
      minorUnits: 1000,
      currency: "USD",
    });
  });

  it("converting to the same currency returns the same amount", () => {
    expect(plain(unwrap(convert(usd(145), "USD", rate("36.5123"))))).toEqual({
      minorUnits: 145,
      currency: "USD",
    });
    expect(plain(unwrap(convert(ves(36512), "VES", rate("36.5123"))))).toEqual({
      minorUnits: 36512,
      currency: "VES",
    });
  });

  it("rounds ties away from zero, also for negative amounts", () => {
    expect(unwrap(convert(usd(1), "VES", rate("1.5"))).minorUnits).toBe(2);
    expect(unwrap(convert(usd(-1), "VES", rate("1.5"))).minorUnits).toBe(-2);
    expect(unwrap(convert(ves(1), "USD", rate("2"))).minorUnits).toBe(1);
    expect(unwrap(convert(ves(-1), "USD", rate("2"))).minorUnits).toBe(-1);
  });

  it("converts the largest VES amount without losing precision", () => {
    // 10^15 / 3 = 333333333333333.33…
    expect(unwrap(convert(ves(MAX_MINOR_UNITS), "USD", rate("3"))).minorUnits).toBe(
      333_333_333_333_333,
    );
  });

  it("fails when the result leaves the range", () => {
    expect(convert(usd(MAX_MINOR_UNITS), "VES", rate("36.5123"))).toEqual({
      ok: false,
      error: "AMOUNT_OUT_OF_RANGE",
    });
    expect(unwrap(convert(usd(MAX_MINOR_UNITS), "VES", rate("1"))).minorUnits).toBe(
      MAX_MINOR_UNITS,
    );
  });
});

describe("applyPercentage", () => {
  it.each([
    [145, 16, 23], // 0.232
    [5, 16, 1], // 0.008
    [150, 3, 5], // 0.045: half away from zero (banker's rounding would give 4)
    [-150, 3, -5], // -0.045
    [150, 0, 0],
    [150, 100, 150],
    [150, 200, 300], // above 100 is legal
  ])("%i minor units at %i %% = %i", (minor, percent, expected) => {
    expect(plain(unwrap(applyPercentage(usd(minor), percent)))).toEqual({
      minorUnits: expected,
      currency: "USD",
    });
  });

  it("keeps the currency", () => {
    expect(unwrap(applyPercentage(ves(1000), 16)).currency).toBe("VES");
  });

  it.each([Number.NaN, 1.5, -1, Number.POSITIVE_INFINITY, 2 ** 53])(
    "rejects the percentage %s",
    (percent) => {
      expect(applyPercentage(usd(100), percent)).toEqual({
        ok: false,
        error: "INVALID_PERCENTAGE",
      });
    },
  );

  it("fails when the result leaves the range", () => {
    expect(applyPercentage(usd(MAX_MINOR_UNITS), 200)).toEqual({
      ok: false,
      error: "AMOUNT_OUT_OF_RANGE",
    });
  });
});
