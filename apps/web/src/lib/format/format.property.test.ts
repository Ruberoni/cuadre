import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { daysInMonth } from "./date.ts";
import {
  formatAmount,
  formatDate,
  formatMoney,
  MAX_MINOR_UNITS,
  parseAmount,
  parseDate,
} from "./index.ts";

// fc.integer stops at 2^31 - 1, so the range up to 10^15 comes from bigInt.
const minorUnits = fc.bigInt({ min: 0n, max: BigInt(MAX_MINOR_UNITS) }).map(Number);
const currency = fc.constantFrom("USD", "VES");

const isoDate = fc
  .tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 12 }))
  .chain(([year, month]) =>
    fc.integer({ min: 1, max: daysInMonth(year, month) }).map((day) => [year, month, day] as const),
  )
  .map(([year, month, day]) => {
    const two = (n: number) => String(n).padStart(2, "0");
    return `${String(year).padStart(4, "0")}-${two(month)}-${two(day)}`;
  });

describe("es-VE formatting round trips (ADR-014)", () => {
  it("formatting minor units and parsing the result gives the same integer", () => {
    fc.assert(
      fc.property(minorUnits, currency, (minor, code) => {
        expect(parseAmount(formatMoney(minor, code), code)).toEqual({ ok: true, value: minor });
        expect(parseAmount(formatAmount(minor))).toEqual({ ok: true, value: minor });
      }),
    );
  });

  it("holds at the edges of the range", () => {
    for (const minor of [0, 1, 99, 100, 999_99, 1_000_00, MAX_MINOR_UNITS]) {
      expect(parseAmount(formatMoney(minor, "VES"), "VES")).toEqual({ ok: true, value: minor });
    }
  });

  it("formatting a date as dd/mm/aaaa and parsing it gives the same date", () => {
    fc.assert(
      fc.property(isoDate, (date) => {
        expect(parseDate(formatDate(date))).toEqual({ ok: true, value: date });
      }),
    );
  });

  it("holds for leap days", () => {
    for (const date of ["2000-02-29", "2028-02-29", "1900-02-28", "0004-02-29"]) {
      expect(parseDate(formatDate(date))).toEqual({ ok: true, value: date });
    }
  });
});
