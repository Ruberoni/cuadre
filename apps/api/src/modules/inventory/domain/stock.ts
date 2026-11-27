// Stock rules (ADR-007): pure, no I/O. A product's stock is its on-hand quantity and its total value
// in USD (cents); the average cost is derived from both and never stored rounded.
import {
  add,
  convert,
  divideRoundHalfAwayFromZero,
  err,
  MAX_QUANTITY_SCALED,
  type Money,
  money,
  multiplyMoneyByQuantity,
  ok,
  QUANTITY_SCALE,
  type Quantity,
  type Rate,
  type Result,
} from "@cuadre/shared-kernel";

export type StockBalance = {
  readonly productId: string;
  /** On-hand quantity in thousandths. */
  readonly onHandScaled: bigint;
  /** Total value of the stock on hand, USD, excluding IVA. */
  readonly totalValueUsd: Money;
};

export type InboundMovement = {
  readonly quantity: Quantity;
  /** What the movement adds to the stock value, USD, excluding IVA. */
  readonly totalCostUsd: Money;
};

export type ApplyInboundError = "INVALID_COST" | "QUANTITY_OUT_OF_RANGE" | "AMOUNT_OUT_OF_RANGE";

export function zeroStockBalance(productId: string): StockBalance {
  const zero = money(0, "USD");
  if (!zero.ok) throw new Error("zero USD is always a valid Money");
  return { productId, onHandScaled: 0n, totalValueUsd: zero.value };
}

/**
 * USD cost an inbound line adds to the stock: `quantity × unit cost`, excluding IVA. A VES line is
 * converted at the goods receipt's frozen rate on its subtotal, so no cent is lost to a rounded
 * unit cost (ADR-005, ADR-007).
 */
export function computeInboundCostUsd(
  quantity: Quantity,
  unitCost: Money,
  frozenRate: Rate,
): Result<Money, "AMOUNT_OUT_OF_RANGE"> {
  const subtotal = multiplyMoneyByQuantity(unitCost, quantity);
  if (!subtotal.ok) return subtotal;
  return convert(subtotal.value, "USD", frozenRate);
}

export function applyInboundMovement(
  current: StockBalance,
  movement: InboundMovement,
): Result<StockBalance, ApplyInboundError> {
  if (movement.totalCostUsd.currency !== "USD" || movement.totalCostUsd.minorUnits < 0) {
    return err("INVALID_COST");
  }
  const onHandScaled = current.onHandScaled + movement.quantity.scaled;
  if (onHandScaled > MAX_QUANTITY_SCALED) return err("QUANTITY_OUT_OF_RANGE");
  const value = add(current.totalValueUsd, movement.totalCostUsd);
  if (!value.ok) return err("AMOUNT_OUT_OF_RANGE");
  return ok({ productId: current.productId, onHandScaled, totalValueUsd: value.value });
}

/**
 * The average cost as an exact fraction: `numeratorMinor / denominatorScaled` is USD cents per
 * unit (`value × 1000 / quantity-in-thousandths`). `null` while nothing is on hand.
 */
export function deriveAverageCostUsd(
  balance: StockBalance,
): { readonly numeratorMinor: bigint; readonly denominatorScaled: bigint } | null {
  if (balance.onHandScaled === 0n) return null;
  return {
    numeratorMinor: BigInt(balance.totalValueUsd.minorUnits) * QUANTITY_SCALE,
    denominatorScaled: balance.onHandScaled,
  };
}

/** The average rounded half away from zero to a cent; for display and outbound costing only. */
export function deriveRoundedAverageCostUsd(balance: StockBalance): Money | null {
  const average = deriveAverageCostUsd(balance);
  if (average === null) return null;
  const rounded = money(
    Number(divideRoundHalfAwayFromZero(average.numeratorMinor, average.denominatorScaled)),
    "USD",
  );
  return rounded.ok ? rounded.value : null;
}
