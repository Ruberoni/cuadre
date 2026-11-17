/**
 * The only rounding rule of the system (ADR-005): half away from zero, to the unit.
 * `n / d` rounded, for `d > 0`; `5 / 2 → 3` and `-5 / 2 → -3` (banker's rounding is not the rule).
 */
export function divideRoundHalfAwayFromZero(n: bigint, d: bigint): bigint {
  const quotient = n / d; // BigInt division truncates toward zero
  const remainder = n % d; // same sign as n
  const distance = remainder < 0n ? -remainder : remainder;
  if (2n * distance < d) return quotient;
  return n < 0n ? quotient - 1n : quotient + 1n;
}
