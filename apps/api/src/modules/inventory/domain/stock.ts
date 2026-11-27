// Stock rules (ADR-007): pure, no I/O. A product's stock is its on-hand quantity and its total value
// in USD (cents); the average cost is derived from both and never stored rounded.
import {
  add,
  convert,
  divideRoundHalfAwayFromZero,
  err,
  MAX_MINOR_UNITS,
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

export type ComputeUnitCostError = "INVALID_COST" | "AMOUNT_OUT_OF_RANGE";

/**
 * Unit cost in USD cents derived from a movement's total USD cost and positive quantity,
 * rounded half away from zero (ADR-005, ADR-007).
 */
export function computeUnitCostUsd(
  totalCostUsd: Money,
  quantity: Quantity,
): Result<Money, ComputeUnitCostError> {
  if (totalCostUsd.currency !== "USD" || totalCostUsd.minorUnits < 0) {
    return err("INVALID_COST");
  }
  const unitMinor = divideRoundHalfAwayFromZero(
    BigInt(totalCostUsd.minorUnits) * QUANTITY_SCALE,
    quantity.scaled,
  );
  if (unitMinor > BigInt(MAX_MINOR_UNITS)) return err("AMOUNT_OUT_OF_RANGE");
  const result = money(Number(unitMinor), "USD");
  return result.ok ? result : err("AMOUNT_OUT_OF_RANGE");
}

export type LedgerMovementInput = {
  readonly id: string;
  readonly documentDate: string;
  readonly direction: "INBOUND" | "OUTBOUND";
  readonly quantity: Quantity;
  /** Total cost of the movement in USD, excluding IVA. */
  readonly totalCostUsd: Money;
  readonly referenceType: string;
  readonly referenceId: string;
};

export type StockLedgerEntry = {
  readonly id: string;
  readonly documentDate: string;
  readonly direction: "INBOUND" | "OUTBOUND";
  readonly quantity: Quantity;
  readonly unitCostUsd: Money;
  readonly averageCostAfterUsd: Money | null;
  readonly onHandAfterScaled: bigint;
  readonly referenceType: string;
  readonly referenceId: string;
};

export type StockLedgerError = ApplyInboundError | "INSUFFICIENT_STOCK";

export type StockLedger = {
  readonly entries: readonly StockLedgerEntry[];
  readonly finalBalance: StockBalance;
};

/**
 * Replays chronological stock movements from zero to produce the kardex running totals
 * (`onHandAfterScaled` and `averageCostAfterUsd`) without accumulating rounding drift (ADR-007).
 */
export function buildStockLedger(
  productId: string,
  movements: readonly LedgerMovementInput[],
): Result<StockLedger, StockLedgerError> {
  let balance = zeroStockBalance(productId);
  const entries: StockLedgerEntry[] = [];

  for (const movement of movements) {
    const unitCost = computeUnitCostUsd(movement.totalCostUsd, movement.quantity);
    if (!unitCost.ok) return unitCost;

    if (movement.direction === "INBOUND") {
      const next = applyInboundMovement(balance, {
        quantity: movement.quantity,
        totalCostUsd: movement.totalCostUsd,
      });
      if (!next.ok) return next;
      balance = next.value;
    } else {
      if (movement.quantity.scaled > balance.onHandScaled) {
        return err("INSUFFICIENT_STOCK");
      }
      const nextOnHand = balance.onHandScaled - movement.quantity.scaled;
      if (nextOnHand === 0n) {
        balance = zeroStockBalance(productId);
      } else {
        const nextMinor = balance.totalValueUsd.minorUnits - movement.totalCostUsd.minorUnits;
        if (nextMinor < 0) return err("INVALID_COST");
        const nextValue = money(nextMinor, "USD");
        if (!nextValue.ok) return err("AMOUNT_OUT_OF_RANGE");
        balance = { productId, onHandScaled: nextOnHand, totalValueUsd: nextValue.value };
      }
    }

    entries.push({
      id: movement.id,
      documentDate: movement.documentDate,
      direction: movement.direction,
      quantity: movement.quantity,
      unitCostUsd: unitCost.value,
      averageCostAfterUsd: deriveRoundedAverageCostUsd(balance),
      onHandAfterScaled: balance.onHandScaled,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
    });
  }

  return ok({ entries, finalBalance: balance });
}
