import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { unwrap } from "../test/unwrap.ts";
import { type CalendarDate, parseCalendarDate } from "./calendar-date.ts";
import { computeVesEquivalent, validateDocumentIssuePreconditions } from "./document-issue.ts";
import { MAX_MINOR_UNITS, money } from "./money.ts";
import { parseRate, RATE_SCALE } from "./rate.ts";

function mustDate(raw: string): CalendarDate {
  return unwrap(parseCalendarDate(raw));
}

const TODAY = mustDate("2026-11-24");

describe("validateDocumentIssuePreconditions", () => {
  it("accepts a DRAFT document with lines and documentDate <= today", () => {
    expect(
      validateDocumentIssuePreconditions({
        status: "DRAFT",
        documentDate: TODAY,
        lineCount: 2,
        today: TODAY,
      }),
    ).toEqual({ ok: true, value: true });

    expect(
      validateDocumentIssuePreconditions({
        status: "DRAFT",
        documentDate: mustDate("2026-11-17"),
        lineCount: 1,
        today: TODAY,
      }),
    ).toEqual({ ok: true, value: true });
  });

  it("rejects non-DRAFT documents with DOCUMENT_NOT_DRAFT even if empty or future-dated", () => {
    expect(
      validateDocumentIssuePreconditions({
        status: "ISSUED",
        documentDate: mustDate("2026-11-25"),
        lineCount: 0,
        today: TODAY,
      }),
    ).toEqual({ ok: false, error: "DOCUMENT_NOT_DRAFT" });
  });

  it("rejects a 0-line DRAFT with EMPTY_DOCUMENT", () => {
    expect(
      validateDocumentIssuePreconditions({
        status: "DRAFT",
        documentDate: TODAY,
        lineCount: 0,
        today: TODAY,
      }),
    ).toEqual({ ok: false, error: "EMPTY_DOCUMENT" });
  });

  it("rejects a DRAFT with documentDate > today with VALIDATION_ERROR DOCUMENT_DATE_IN_FUTURE", () => {
    expect(
      validateDocumentIssuePreconditions({
        status: "DRAFT",
        documentDate: mustDate("2026-11-25"),
        lineCount: 1,
        today: TODAY,
      }),
    ).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [{ field: "documentDate", code: "DOCUMENT_DATE_IN_FUTURE" }],
    });
  });
});

describe("computeVesEquivalent", () => {
  it("converts USD $226.00 at 36.51230000 to Bs. 8.251,78 rounded half away from zero (AC #1)", () => {
    const usd = unwrap(money(22600, "USD"));
    const rate = unwrap(parseRate("36.51230000"));
    const result = computeVesEquivalent(usd, rate);
    expect(result).toEqual({ ok: true, value: unwrap(money(825178, "VES")) });
  });

  it("returns null for VES amounts", () => {
    const ves = unwrap(money(12345, "VES"));
    const rate = unwrap(parseRate("36.51230000"));
    expect(computeVesEquivalent(ves, rate)).toEqual({ ok: true, value: null });
  });

  it("returns AMOUNT_OUT_OF_RANGE when USD conversion exceeds MAX_MINOR_UNITS", () => {
    const usd = unwrap(money(MAX_MINOR_UNITS, "USD"));
    const rate = unwrap(parseRate("2.00000000"));
    expect(computeVesEquivalent(usd, rate)).toEqual({ ok: false, error: "AMOUNT_OUT_OF_RANGE" });
  });
});

describe("computeVesEquivalent properties (ADR-005, ADR-013)", () => {
  const rateArb = fc
    .tuple(fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 0, max: 99_999_999 }))
    .map(([int, frac]) => unwrap(parseRate(`${int}.${String(frac).padStart(8, "0")}`)));

  it("converts non-negative USD to non-negative VES integer minor units within half a centimo and monotonic in rate", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), rateArb, rateArb, (minor, r1, r2) => {
        const usd = unwrap(money(minor, "USD"));
        const [lowRate, highRate] = r1.scaled <= r2.scaled ? [r1, r2] : [r2, r1];

        const resLow = unwrap(computeVesEquivalent(usd, lowRate));
        const resHigh = unwrap(computeVesEquivalent(usd, highRate));
        expect(resLow).not.toBeNull();
        expect(resHigh).not.toBeNull();
        if (resLow === null || resHigh === null) return;

        expect(resLow.currency).toBe("VES");
        expect(Number.isSafeInteger(resLow.minorUnits)).toBe(true);
        expect(resLow.minorUnits).toBeGreaterThanOrEqual(0);
        expect(resHigh.minorUnits).toBeGreaterThanOrEqual(resLow.minorUnits);

        // Rounding error bound: |converted * RATE_SCALE - minor * scaled| <= RATE_SCALE / 2
        const diff = BigInt(resLow.minorUnits) * RATE_SCALE - BigInt(minor) * lowRate.scaled;
        const absDiff = diff < 0n ? -diff : diff;
        expect(absDiff * 2n <= RATE_SCALE).toBe(true);
      }),
    );
  });

  it("always returns null for VES totals regardless of rate", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000_000 }), rateArb, (minor, rate) => {
        const ves = unwrap(money(minor, "VES"));
        expect(computeVesEquivalent(ves, rate)).toEqual({ ok: true, value: null });
      }),
    );
  });
});
