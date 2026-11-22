import { type CalendarDate, rateToString } from "@cuadre/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  correctExchangeRate,
  createExchangeRate,
  type ExchangeRateInput,
  lookupAndFreezeRate,
  lookupRate,
  reconstituteExchangeRate,
} from "./exchange-rate.ts";

const today = "2026-11-17" as CalendarDate;

const issuesOf = (input: ExchangeRateInput, refToday = today) => {
  const result = createExchangeRate(input, refToday);
  if (result.ok || result.error !== "VALIDATION_ERROR") {
    throw new Error(`expected VALIDATION_ERROR, got ${JSON.stringify(result)}`);
  }
  return result.issues;
};

describe("createExchangeRate", () => {
  it("normalises a valid rate to 8 decimals and starts unfrozen", () => {
    const result = createExchangeRate({ date: "2026-11-17", rate: "36.5123" }, today);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date).toBe("2026-11-17");
    expect(rateToString(result.value.rate)).toBe("36.51230000");
    expect(result.value.frozen).toBe(false);
  });

  it("accepts a date up to 7 days ahead and rejects 8 days ahead with RATE_DATE_TOO_FAR", () => {
    expect(createExchangeRate({ date: "2026-11-24", rate: "36.5" }, today).ok).toBe(true);
    expect(createExchangeRate({ date: "2026-11-25", rate: "36.5" }, today)).toEqual({
      ok: false,
      error: "RATE_DATE_TOO_FAR",
      date: "2026-11-25",
    });
  });

  it("accepts past dates", () => {
    expect(createExchangeRate({ date: "2026-11-10", rate: "36.4" }, today).ok).toBe(true);
  });

  it("rejects 9 decimals as TOO_MANY_DECIMALS", () => {
    expect(issuesOf({ date: "2026-11-17", rate: "36.123456789" })).toEqual([
      { field: "rate", code: "TOO_MANY_DECIMALS" },
    ]);
  });

  it.each(["0", "0.0", "0.00000000", "-1", "-36.5", "-0.00000001"])(
    "rejects %j as NOT_POSITIVE",
    (rate) => {
      expect(issuesOf({ date: "2026-11-17", rate })).toEqual([
        { field: "rate", code: "NOT_POSITIVE" },
      ]);
    },
  );

  it("accepts 12 integer digits and rejects 13 integer digits as OUT_OF_RANGE", () => {
    expect(
      createExchangeRate({ date: "2026-11-17", rate: "999999999999.99999999" }, today).ok,
    ).toBe(true);
    expect(issuesOf({ date: "2026-11-17", rate: "1000000000000" })).toEqual([
      { field: "rate", code: "OUT_OF_RANGE" },
    ]);
  });

  it.each(["36,5", "abc", "036.5", "36.", ".5", "1e3"])("rejects %j as INVALID_FORMAT", (rate) => {
    expect(issuesOf({ date: "2026-11-17", rate })).toEqual([
      { field: "rate", code: "INVALID_FORMAT" },
    ]);
  });

  it("reports both invalid date and missing rate at once", () => {
    expect(issuesOf({ date: "2026-02-30", rate: "" })).toEqual([
      { field: "date", code: "INVALID_DATE" },
      { field: "rate", code: "REQUIRED" },
    ]);
  });
});

describe("reconstituteExchangeRate", () => {
  it("rebuilds stored rows regardless of today", () => {
    const res = reconstituteExchangeRate({
      date: "2026-11-24",
      rate: "36.51230000",
      frozen: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.frozen).toBe(true);
    expect(rateToString(res.value.rate)).toBe("36.51230000");
  });
});

describe("correctExchangeRate", () => {
  it("updates an unfrozen rate", () => {
    const created = createExchangeRate({ date: "2026-11-17", rate: "36.5123" }, today);
    if (!created.ok) throw new Error("setup failed");
    const corrected = correctExchangeRate(created.value, "36.52");
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(rateToString(corrected.value.rate)).toBe("36.52000000");
  });

  it("rejects correcting a frozen rate with RATE_ALREADY_FROZEN", () => {
    const created = createExchangeRate({ date: "2026-11-17", rate: "36.5123" }, today);
    if (!created.ok) throw new Error("setup failed");
    const frozen = { ...created.value, frozen: true };
    expect(correctExchangeRate(frozen, "36.52")).toEqual({
      ok: false,
      error: "RATE_ALREADY_FROZEN",
      date: "2026-11-17",
    });
  });
});

describe("lookupRate and lookupAndFreezeRate", () => {
  it("returns the latest rate on or before the target date, or MISSING_EXCHANGE_RATE", () => {
    const r14 = createExchangeRate({ date: "2026-11-14", rate: "36.4" }, today);
    const r17 = createExchangeRate({ date: "2026-11-17", rate: "36.5123" }, today);
    if (!r14.ok || !r17.ok) throw new Error("setup failed");
    const rates = [r14.value, r17.value];

    const sun = lookupRate(rates, "2026-11-16" as CalendarDate);
    expect(sun.ok && rateToString(sun.value.rate)).toBe("36.40000000");

    const mon = lookupRate(rates, "2026-11-17" as CalendarDate);
    expect(mon.ok && rateToString(mon.value.rate)).toBe("36.51230000");

    expect(lookupRate(rates, "2026-11-13" as CalendarDate)).toEqual({
      ok: false,
      error: "MISSING_EXCHANGE_RATE",
    });
  });

  it("lookupAndFreezeRate marks only the returned rate frozen", () => {
    const r14 = createExchangeRate({ date: "2026-11-14", rate: "36.4" }, today);
    const r17 = createExchangeRate({ date: "2026-11-17", rate: "36.5123" }, today);
    if (!r14.ok || !r17.ok) throw new Error("setup failed");

    const res = lookupAndFreezeRate([r14.value, r17.value], "2026-11-16" as CalendarDate);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.rate.date).toBe("2026-11-14");
    expect(res.value.rate.frozen).toBe(true);
    expect(res.value.rates.find((r) => r.date === "2026-11-14")?.frozen).toBe(true);
    expect(res.value.rates.find((r) => r.date === "2026-11-17")?.frozen).toBe(false);
  });
});
