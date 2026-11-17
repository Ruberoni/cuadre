import { groupThousands } from "./money.ts";

const RATE = /^(\d+)(?:\.(\d{1,8}))?$/;

/**
 * An exchange rate always shows 8 decimals, never rounded: `"36.5123"` → `36,51230000`.
 * The rate is a decimal string (as Postgres `numeric` returns it), never a float; the symbol
 * (`Bs. 36,51230000`) is added by the screen that needs it.
 */
export function formatRate(rate: string): string {
  const match = RATE.exec(rate);
  if (match === null) {
    throw new RangeError(`A rate is a decimal string with up to 8 decimals, got "${rate}"`);
  }
  const [, integerPart = "", decimals = ""] = match;
  return `${groupThousands(integerPart)},${decimals.padEnd(8, "0")}`;
}
