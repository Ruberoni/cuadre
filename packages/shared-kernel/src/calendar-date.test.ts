import { describe, expect, it } from "vitest";
import {
  addDays,
  type CalendarDate,
  compareCalendarDates,
  parseCalendarDate,
  todayCaracas,
} from "./index.ts";

describe("parseCalendarDate", () => {
  it("accepts valid YYYY-MM-DD calendar dates including leap days", () => {
    expect(parseCalendarDate("2026-11-17")).toEqual({ ok: true, value: "2026-11-17" });
    expect(parseCalendarDate("2028-02-29")).toEqual({ ok: true, value: "2028-02-29" });
    expect(parseCalendarDate("2000-02-29")).toEqual({ ok: true, value: "2000-02-29" });
    expect(parseCalendarDate(" 2026-11-17 ")).toEqual({ ok: true, value: "2026-11-17" });
  });

  it.each(["", "   "])("rejects %j as REQUIRED", (raw) => {
    expect(parseCalendarDate(raw)).toEqual({ ok: false, error: "REQUIRED" });
  });

  it.each([
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "17/11/2026",
    "2026-1-1",
    "not-a-date",
  ])("rejects %j as INVALID_DATE", (raw) => {
    expect(parseCalendarDate(raw)).toEqual({ ok: false, error: "INVALID_DATE" });
  });
});

describe("addDays", () => {
  it("adds and subtracts days across month, year and leap-year boundaries", () => {
    const d = (s: string) => s as CalendarDate;
    expect(addDays(d("2026-11-17"), 7)).toBe("2026-11-24");
    expect(addDays(d("2026-11-17"), 8)).toBe("2026-11-25");
    expect(addDays(d("2026-12-28"), 7)).toBe("2027-01-04");
    expect(addDays(d("2028-02-28"), 1)).toBe("2028-02-29");
    expect(addDays(d("2026-03-01"), -1)).toBe("2026-02-28");
  });
});

describe("compareCalendarDates", () => {
  it("compares chronological order", () => {
    const d = (s: string) => s as CalendarDate;
    expect(compareCalendarDates(d("2026-11-16"), d("2026-11-17"))).toBe(-1);
    expect(compareCalendarDates(d("2026-11-17"), d("2026-11-17"))).toBe(0);
    expect(compareCalendarDates(d("2026-11-18"), d("2026-11-17"))).toBe(1);
  });
});

describe("todayCaracas", () => {
  it("uses fixed UTC-4 offset (America/Caracas)", () => {
    expect(todayCaracas(new Date("2026-11-18T03:59:59Z"))).toBe("2026-11-17");
    expect(todayCaracas(new Date("2026-11-18T04:00:00Z"))).toBe("2026-11-18");
  });
});
