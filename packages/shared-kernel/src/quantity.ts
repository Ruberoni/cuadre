import type { Brand } from "./brand.ts";
import { err, ok, type Result } from "./result.ts";

/** Quantities hold up to 3 decimal places (thousandths: `12.345` → `12345n`). */
export const QUANTITY_SCALE = 1000n;
export const QUANTITY_DECIMALS = 3;
/** Largest quantity in thousandths (`10^12` units, matching Postgres `numeric(15, 3)`). */
export const MAX_QUANTITY_SCALED = 10n ** 12n * QUANTITY_SCALE;

/**
 * Exact positive quantity held as integer thousandths, never a float.
 * Holds a `bigint`, so serialize it with `quantityToString`.
 */
export type Quantity = { readonly scaled: bigint } & Brand<"Quantity">;

export type QuantityError =
  | "REQUIRED"
  | "INVALID_FORMAT"
  | "NOT_POSITIVE"
  | "OUT_OF_RANGE"
  | "QUANTITY_NOT_WHOLE"
  | "QUANTITY_TOO_PRECISE";

const DECIMAL = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

/**
 * Parses a dot-decimal quantity string (wire/domain format).
 * Whole-number units (`allowDecimals: false`) reject fractional parts with `QUANTITY_NOT_WHOLE`;
 * decimal units (`allowDecimals: true`) allow up to 3 decimals and reject more with `QUANTITY_TOO_PRECISE`.
 */
export function parseQuantity(
  raw: string,
  { allowDecimals }: { allowDecimals: boolean },
): Result<Quantity, QuantityError> {
  const trimmed = raw.trim();
  if (trimmed === "") return err("REQUIRED");

  const match = DECIMAL.exec(trimmed);
  if (match === null) return err("INVALID_FORMAT");

  const [, integerPart = "", decimals = ""] = match;
  if (!allowDecimals) {
    if (decimals !== "" && /[1-9]/.test(decimals)) {
      return err("QUANTITY_NOT_WHOLE");
    }
    if (decimals.length > QUANTITY_DECIMALS) {
      return err("QUANTITY_TOO_PRECISE");
    }
  } else if (decimals.length > QUANTITY_DECIMALS) {
    return err("QUANTITY_TOO_PRECISE");
  }

  const scaled = BigInt(integerPart + decimals.padEnd(QUANTITY_DECIMALS, "0"));
  if (scaled <= 0n) return err("NOT_POSITIVE");
  if (scaled > MAX_QUANTITY_SCALED) return err("OUT_OF_RANGE");

  return ok({ scaled } as Quantity);
}

/** Canonical dot-decimal string without trailing fractional zeros: `100000n` → `"100"`, `12345n` → `"12.345"`. */
export function quantityToString(quantity: Quantity): string {
  const whole = quantity.scaled / QUANTITY_SCALE;
  const frac = quantity.scaled % QUANTITY_SCALE;
  if (frac === 0n) return whole.toString();
  const fracText = frac.toString().padStart(QUANTITY_DECIMALS, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracText}`;
}
