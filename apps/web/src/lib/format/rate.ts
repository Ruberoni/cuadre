import { EXCHANGE_RATE_DECIMALS, EXCHANGE_RATE_MAX_INTEGER_DIGITS } from "@cuadre/contracts";
import { err, ok, type Result } from "@cuadre/shared-kernel";
import { groupThousands, NBSP } from "./money.ts";

const RATE = /^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/;
const GROUPED = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,(\d+))?$/;
const PLAIN = /^\d+(?:,(\d+))?$/;

export type ParseRateError = "NOT_A_NUMBER" | "TOO_MANY_DECIMALS" | "NOT_POSITIVE" | "OUT_OF_RANGE";

/**
 * An exchange rate always shows 8 decimals, never rounded: `"36.5123"` → `36,51230000`.
 * The rate is a decimal string (as Postgres `numeric` returns it), never a float; the symbol
 * (`Bs. 36,51230000`) is added by `formatBcvRate`.
 */
export function formatRate(rate: string): string {
  const match = RATE.exec(rate);
  if (match === null) {
    throw new RangeError(`A rate is a decimal string with up to 8 decimals, got "${rate}"`);
  }
  const [, integerPart = "", decimals = ""] = match;
  return `${groupThousands(integerPart)},${decimals.padEnd(EXCHANGE_RATE_DECIMALS, "0")}`;
}

/** `36.5123` → `Bs. 36,51230000` (with no-break space). */
export function formatBcvRate(rate: string): string {
  return `Bs.${NBSP}${formatRate(rate)}`;
}

/**
 * Reads an es-VE exchange rate typed by the user into a canonical 8-decimal dot string
 * (`"36,5123"` → `"36.51230000"`). Never uses floating-point numbers.
 */
export function parseRateInput(input: string): Result<string, ParseRateError> {
  let text = input.trim();
  if (text.startsWith("Bs.")) {
    text = text.slice("Bs.".length).trim();
  }

  if (text.startsWith("-")) {
    const magnitude = text.slice(1).trim();
    if (GROUPED.test(magnitude) || PLAIN.test(magnitude)) return err("NOT_POSITIVE");
    return err("NOT_A_NUMBER");
  }

  const match = GROUPED.exec(text) ?? PLAIN.exec(text);
  if (match === null) return err("NOT_A_NUMBER");

  const decimals = match[1] ?? "";
  if (decimals.length > EXCHANGE_RATE_DECIMALS) return err("TOO_MANY_DECIMALS");

  const rawInteger = text.split(",")[0]?.replaceAll(".", "") ?? "";
  const integerPart = rawInteger.replace(/^0+(?=\d)/, "");
  const scaled = BigInt(integerPart + decimals.padEnd(EXCHANGE_RATE_DECIMALS, "0"));
  if (scaled <= 0n) return err("NOT_POSITIVE");
  if (integerPart.length > EXCHANGE_RATE_MAX_INTEGER_DIGITS) return err("OUT_OF_RANGE");

  return ok(`${integerPart}.${decimals.padEnd(EXCHANGE_RATE_DECIMALS, "0")}`);
}
