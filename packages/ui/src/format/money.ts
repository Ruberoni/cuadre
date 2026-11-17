// es-VE money formatting and parsing (Design System → Formatting). Implemented once here; screens
// never call Intl or toFixed themselves. Works on integer minor units, never on floats (ADR-005),
// and groups digits by hand so the output does not depend on the ICU data of the runtime.
import { err, ok, type Result } from "../lib/result.ts";

export type Currency = "USD" | "VES";

/** No-break space: keeps the symbol on the same line as its amount. */
export const NBSP = " ";

const SYMBOLS: Record<Currency, string> = { USD: "$", VES: "Bs." };

/** Largest amount the helper accepts, in minor units (10^15). */
export const MAX_MINOR_UNITS = 10 ** 15;

export type ParseAmountError =
  | "NOT_A_NUMBER"
  | "TOO_MANY_DECIMALS"
  | "OUT_OF_RANGE"
  | "WRONG_CURRENCY_SYMBOL";

/** `1234567` → `1.234.567`. */
export function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** The amount without symbol: `123456` → `1.234,56`. */
export function formatAmount(minorUnits: number): string {
  if (!Number.isSafeInteger(minorUnits) || minorUnits < 0) {
    throw new RangeError(`Minor units must be a non-negative safe integer, got ${minorUnits}`);
  }
  const digits = String(minorUnits).padStart(3, "0");
  return `${groupThousands(digits.slice(0, -2))},${digits.slice(-2)}`;
}

/** `145` USD → `$ 1,45`; `123456789` VES → `Bs. 1.234.567,89` (symbol, no-break space, amount). */
export function formatMoney(minorUnits: number, currency: Currency): string {
  return `${SYMBOLS[currency]}${NBSP}${formatAmount(minorUnits)}`;
}

const GROUPED = /^\d{1,3}(?:\.\d{3})+(?:,(\d+))?$/;
const PLAIN = /^\d+(?:,(\d+))?$/;

/**
 * Reads an amount typed by the user into minor units: `1,45` → 145, `1.234,56` → 123456.
 * `,` is the decimal separator and `.` only a well-placed thousands separator (`1.23` is an
 * error, not 123). The symbol of the currency is optional. More than 2 decimals is an error,
 * never silently rounded.
 */
export function parseAmount(input: string, currency?: Currency): Result<number, ParseAmountError> {
  let text = input.trim();

  const symbol = (Object.keys(SYMBOLS) as Currency[]).find((code) =>
    text.startsWith(SYMBOLS[code]),
  );
  if (symbol !== undefined) {
    if (currency !== undefined && symbol !== currency) return err("WRONG_CURRENCY_SYMBOL");
    text = text.slice(SYMBOLS[symbol].length).trim();
  }

  const match = GROUPED.exec(text) ?? PLAIN.exec(text);
  if (match === null) return err("NOT_A_NUMBER");

  const decimals = match[1] ?? "";
  if (decimals.length > 2) return err("TOO_MANY_DECIMALS");

  const integerPart = text.split(",")[0]?.replaceAll(".", "") ?? "";
  const minorUnits = BigInt(integerPart + decimals.padEnd(2, "0"));
  if (minorUnits > BigInt(MAX_MINOR_UNITS)) return err("OUT_OF_RANGE");
  return ok(Number(minorUnits));
}
