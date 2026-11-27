import type { Money, Quantity, Rate, Result } from "@cuadre/shared-kernel";
import type { DbTransaction } from "../../../db/client.ts";
import type { StockBalance } from "../domain/stock.ts";

/** One inbound line, as the owner of the source document (e.g. a goods receipt) describes it. */
export type InboundMovementInput = {
  readonly productId: string;
  readonly quantity: Quantity;
  /** Unit cost in the document's currency, excluding IVA. */
  readonly unitCost: Money;
  /** The document's frozen rate; converts a VES cost to USD (ADR-007). */
  readonly frozenRate: Rate;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly documentDate: string;
};

export type RecordInboundMovementsError =
  | "AMOUNT_OUT_OF_RANGE"
  | "QUANTITY_OUT_OF_RANGE"
  | "INVALID_COST";

export type RecordInboundMovementsResult = Result<true, RecordInboundMovementsError>;

export type StockMovementRow = {
  readonly productId: string;
  readonly direction: "INBOUND" | "OUTBOUND";
  readonly quantityScaled: bigint;
  readonly totalCostUsdMinor: number;
  readonly referenceType: string;
  readonly referenceId: string;
  readonly documentDate: string;
};

export type InventoryRepository = {
  /** Makes sure each product has a balance row, then locks them (`FOR UPDATE`), sorted by product id. */
  lockBalances(
    productIds: readonly string[],
    tx: DbTransaction,
  ): Promise<Map<string, StockBalance>>;
  saveBalance(balance: StockBalance, tx: DbTransaction): Promise<void>;
  insertMovements(rows: readonly StockMovementRow[], tx: DbTransaction): Promise<void>;
  findBalance(productId: string, executor: DbTransaction | undefined): Promise<StockBalance>;
};
