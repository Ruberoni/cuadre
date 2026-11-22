// Calendar dates are `YYYY-MM-DD` strings (like `DocumentDate`): no `Date`, no time zones.
import { err, ok, type Result } from "@cuadre/shared-kernel";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const CARACAS_OFFSET_MS = 4 * 60 * 60 * 1000;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isRealDate(year: number, month: number, day: number): boolean {
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function formatIsoUtc(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `2026-11-17` → `17/11/2026`. Throws on anything that is not a real calendar date. */
export function formatDate(date: string): string {
  const [, year = "", month = "", day = ""] = ISO.exec(date) ?? [];
  if (!isRealDate(Number(year), Number(month), Number(day))) {
    throw new RangeError(`Expected a calendar date as YYYY-MM-DD, got "${date}"`);
  }
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
  const [, year = "", month = "", day = ""] = ISO.exec(date) ?? [];
  if (!isRealDate(Number(year), Number(month), Number(day))) {
    throw new RangeError(`Expected a calendar date as YYYY-MM-DD, got "${date}"`);
  }
  return formatIsoUtc(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days)));
}

/** Today's calendar date in Venezuela (fixed UTC-4 offset, independent of runtime ICU data). */
export function todayCaracas(now: Date = new Date()): string {
  return formatIsoUtc(new Date(now.getTime() - CARACAS_OFFSET_MS));
}
