import type { Brand } from "./brand.ts";
import { err, ok, type Result } from "./result.ts";

/** A calendar date in `YYYY-MM-DD` format (no time zones). */
export type CalendarDate = string & Brand<"CalendarDate">;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isRealDate(year: number, month: number, day: number): boolean {
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function formatUtcParts(date: Date): CalendarDate {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as CalendarDate;
}

/** Validates a `YYYY-MM-DD` calendar date string. */
export function parseCalendarDate(raw: string): Result<CalendarDate, "REQUIRED" | "INVALID_DATE"> {
  const trimmed = raw.trim();
  if (trimmed === "") return err("REQUIRED");
  const match = ISO.exec(trimmed);
  if (match === null) return err("INVALID_DATE");
  const [, yearText = "", monthText = "", dayText = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isRealDate(year, month, day)) return err("INVALID_DATE");
  return ok(trimmed as CalendarDate);
}

/** Adds `days` (positive or negative) to a `CalendarDate`. */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const [, yearText = "", monthText = "", dayText = ""] = ISO.exec(date) ?? [];
  const utc = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText) + days));
  return formatUtcParts(utc);
}

/** Chronological order for zero-padded `YYYY-MM-DD` calendar dates. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Today's calendar date in Venezuela (fixed UTC-4 offset, independent of runtime ICU data). */
export function todayCaracas(now: Date = new Date()): CalendarDate {
  return formatUtcParts(new Date(now.getTime() - CARACAS_OFFSET_MS));
}
