import type { Brand } from "./brand.ts";
import { err, ok, type Result } from "./result.ts";

/** An exchange rate value always has 8 decimals (as the BCV publishes it). */
export const RATE_SCALE = 10n ** 8n;

/**
 * Exact value of an exchange rate: VES per 1 USD, held as an integer × 10^8, never a float.
 * Holds a `bigint`, so it does not go through `JSON.stringify`: serialize it with `rateToString`.
 */
export type Rate = { readonly scaled: bigint } & Brand<"Rate">;

const RATE = /^(0|[1-9]\d*)(?:\.(\d{1,8}))?$/;

/** `"36.5123"` → 36.51230000. More than 8 decimals, a rate ≤ 0 or malformed text is rejected. */
export function parseRate(text: string): Result<Rate, "INVALID_RATE"> {
  const match = RATE.exec(text);
  if (match === null) return err("INVALID_RATE");
  const [, integerPart = "", decimals = ""] = match;
  const scaled = BigInt(integerPart + decimals.padEnd(8, "0"));
  if (scaled <= 0n) return err("INVALID_RATE");
  return ok({ scaled } as Rate);
}

/** Always 8 decimals: `36.51230000`. */
export function rateToString(rate: Rate): string {
  const digits = rate.scaled.toString().padStart(9, "0");
  return `${digits.slice(0, -8)}.${digits.slice(-8)}`;
}
