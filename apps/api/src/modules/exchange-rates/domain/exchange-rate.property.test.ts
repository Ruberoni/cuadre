import { parseRate } from "@cuadre/shared-kernel";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays, type CalendarDate } from "./calendar-date.ts";
import { type ExchangeRateRecord, lookupAndFreezeRate, lookupRate } from "./exchange-rate.ts";

const baseDate = "2026-01-01" as CalendarDate;

const calendarDateArb = fc.integer({ min: 0, max: 365 }).map((offset) => addDays(baseDate, offset));

const rateRecordArb = fc
  .record({
    offset: fc.integer({ min: 0, max: 365 }),
    scaledInt: fc.integer({ min: 1, max: 9_999_999 }),
    frozen: fc.boolean(),
  })
  .map(({ offset, scaledInt, frozen }): ExchangeRateRecord => {
    const parsed = parseRate(`${scaledInt}.12345678`);
    if (!parsed.ok) throw new Error("invalid arb rate");
    return {
      date: addDays(baseDate, offset),
      rate: parsed.value,
      frozen,
    };
  });

const uniqueDateRatesArb = fc.array(rateRecordArb, { minLength: 0, maxLength: 20 }).map((items) => {
  const byDate = new Map<CalendarDate, ExchangeRateRecord>();
  for (const item of items) byDate.set(item.date, item);
  return [...byDate.values()];
});

describe("exchange-rate lookup invariants (ADR-005, ADR-014)", () => {
  it("lookup returns the rate with the greatest date <= target date, or MISSING_EXCHANGE_RATE", () => {
    fc.assert(
      fc.property(uniqueDateRatesArb, calendarDateArb, (rates, targetDate) => {
        const result = lookupRate(rates, targetDate);
        const candidates = rates.filter((r) => r.date <= targetDate);
        if (candidates.length === 0) {
          expect(result).toEqual({ ok: false, error: "MISSING_EXCHANGE_RATE" });
          return;
        }
        const expected = candidates.reduce((best, cur) => (cur.date > best.date ? cur : best));
        expect(result).toEqual({ ok: true, value: expected });
      }),
    );
  });

  it("lookupAndFreezeRate freezes exactly the rate it returns and leaves all others unchanged", () => {
    fc.assert(
      fc.property(uniqueDateRatesArb, calendarDateArb, (rates, targetDate) => {
        const lookup = lookupRate(rates, targetDate);
        const frozenResult = lookupAndFreezeRate(rates, targetDate);

        if (!lookup.ok) {
          expect(frozenResult).toEqual({ ok: false, error: "MISSING_EXCHANGE_RATE" });
          return;
        }
        expect(frozenResult.ok).toBe(true);
        if (!frozenResult.ok) return;

        expect(frozenResult.value.rate.date).toBe(lookup.value.date);
        expect(frozenResult.value.rate.rate).toEqual(lookup.value.rate);
        expect(frozenResult.value.rate.frozen).toBe(true);

        for (const before of rates) {
          const after = frozenResult.value.rates.find((r) => r.date === before.date);
          expect(after).toBeDefined();
          if (before.date === lookup.value.date) {
            expect(after?.frozen).toBe(true);
          } else {
            expect(after?.frozen).toBe(before.frozen);
          }
        }
      }),
    );
  });
});
