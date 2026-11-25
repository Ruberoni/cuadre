// Money value object (ADR-005): integer minor units + currency. All arithmetic and rounding of
// money goes through here. Both currencies have 2-decimal minor units (cents, céntimos).
import type { Brand } from "./brand.ts";
import { QUANTITY_SCALE, type Quantity } from "./quantity.ts";
import { RATE_SCALE, type Rate } from "./rate.ts";
import { err, ok, type Result } from "./result.ts";
import { divideRoundHalfAwayFromZero } from "./rounding.ts";

export type Currency = "USD" | "VES";

/** Largest amount of minor units a `Money` holds (10^15), far inside the safe integer range. */
export const MAX_MINOR_UNITS = 10 ** 15;
const MAX = BigInt(MAX_MINOR_UNITS);

/** Plain and JSON-serializable. Build it with `money()`, never with an object literal. */
export type Money = { readonly minorUnits: number; readonly currency: Currency } & Brand<"Money">;

/** Single range check: every operation builds its result here. */
function fromBigInt(value: bigint, currency: Currency): Result<Money, "AMOUNT_OUT_OF_RANGE"> {
  if (value > MAX || value < -MAX) return err("AMOUNT_OUT_OF_RANGE");
  return ok({ minorUnits: Number(value), currency } as Money);
}

/** `money(145, "USD")` is 1.45 USD. Fractional or non-finite minor units are rejected. */
export function money(
  minorUnits: number,
  currency: Currency,
): Result<Money, "INVALID_AMOUNT" | "AMOUNT_OUT_OF_RANGE"> {
  if (!Number.isInteger(minorUnits)) return err("INVALID_AMOUNT");
  if (Math.abs(minorUnits) > MAX_MINOR_UNITS) return err("AMOUNT_OUT_OF_RANGE");
  return ok({ minorUnits: minorUnits + 0, currency } as Money); // `+ 0` turns -0 into 0
}

export function add(
  a: Money,
  b: Money,
): Result<Money, "CURRENCY_MISMATCH" | "AMOUNT_OUT_OF_RANGE"> {
  if (a.currency !== b.currency) return err("CURRENCY_MISMATCH");
  return fromBigInt(BigInt(a.minorUnits) + BigInt(b.minorUnits), a.currency);
}

/** Converts at an explicit rate (there is no implicit "current rate"). Same currency: unchanged. */
export function convert(
  amount: Money,
  to: Currency,
  rate: Rate,
): Result<Money, "AMOUNT_OUT_OF_RANGE"> {
  if (amount.currency === to) return ok(amount);
  const minor = BigInt(amount.minorUnits);
  const converted =
    to === "VES"
      ? divideRoundHalfAwayFromZero(minor * rate.scaled, RATE_SCALE)
      : divideRoundHalfAwayFromZero(minor * RATE_SCALE, rate.scaled);
  return fromBigInt(converted, to);
}

/** `percent` is a whole number ≥ 0 (16 for IVA general, 3 for IGTF); above 100 is allowed. */
export function applyPercentage(
  amount: Money,
  percent: number,
): Result<Money, "INVALID_PERCENTAGE" | "AMOUNT_OUT_OF_RANGE"> {
  if (!Number.isSafeInteger(percent) || percent < 0) return err("INVALID_PERCENTAGE");
  const portion = divideRoundHalfAwayFromZero(BigInt(amount.minorUnits) * BigInt(percent), 100n);
  return fromBigInt(portion, amount.currency);
}

/** Multiplies a unit `Money` amount by an exact `Quantity` (thousandths), rounding half away from zero. */
export function multiplyMoneyByQuantity(
  unitAmount: Money,
  quantity: Quantity,
): Result<Money, "AMOUNT_OUT_OF_RANGE"> {
  const product = divideRoundHalfAwayFromZero(
    BigInt(unitAmount.minorUnits) * quantity.scaled,
    QUANTITY_SCALE,
  );
  return fromBigInt(product, unitAmount.currency);
}
