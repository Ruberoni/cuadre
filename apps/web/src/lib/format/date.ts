// Calendar dates are `YYYY-MM-DD` strings (like `DocumentDate`): no `Date`, no time zones.
import {
  addDays as addCalendarDays,
  daysInMonth,
  err,
  isRealDate,
  ok,
  parseCalendarDate,
  type Result,
  todayCaracas,
} from "@cuadre/shared-kernel";

const DISPLAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export { daysInMonth, todayCaracas };

/** `2026-11-17` → `17/11/2026`. Throws on anything that is not a real calendar date. */
export function formatDate(date: string): string {
  const parsed = parseCalendarDate(date.trim() === date ? date : "");
  if (!parsed.ok) {
    throw new RangeError(`Expected a calendar date as YYYY-MM-DD, got "${date}"`);
  }
  const [year, month, day] = parsed.value.split("-");
  return `${day}/${month}/${year}`;
}

/** `17/11/2026` → `2026-11-17`. Strict: two-digit day and month, and a date that exists. */
export function parseDate(input: string): Result<string, "INVALID_DATE"> {
  const [, day = "", month = "", year = ""] = DISPLAY.exec(input.trim()) ?? [];
  if (!isRealDate(Number(year), Number(month), Number(day))) return err("INVALID_DATE");
  return ok(`${year}-${month}-${day}`);
}

/** Adds `days` to a `YYYY-MM-DD` calendar date. */
export function addDays(date: string, days: number): string {
  const parsed = parseCalendarDate(date.trim() === date ? date : "");
  if (!parsed.ok) {
    throw new RangeError(`Expected a calendar date as YYYY-MM-DD, got "${date}"`);
  }
  return addCalendarDays(parsed.value, days);
}
