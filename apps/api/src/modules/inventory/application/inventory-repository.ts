import type { UnitOfMeasure } from "@cuadre/contracts";
import type { Money, Quantity, Rate, Result } from "@cuadre/shared-kernel";
import type { DbExecutor, DbTransaction } from "../../../db/client.ts";
import type { LedgerMovementInput, StockBalance } from "../domain/stock.ts";

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

export type KardexProductRef = {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly unitOfMeasure: UnitOfMeasure;
};

/** Read-only cross-module lookups needed by the kardex use case (injected by app wiring, ADR-001). */
export type KardexLookups = {
  findProductById(productId: string): Promise<KardexProductRef | null>;
  findGoodsReceiptInvoiceNumbersByIds?(
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;
};

export type InventoryRepository = {
  /** Makes sure each product has a balance row, then locks them (`FOR UPDATE`), sorted by product id. */
  lockBalances(
    productIds: readonly string[],
    tx: DbTransaction,
  ): Promise<Map<string, StockBalance>>;
  saveBalance(balance: StockBalance, tx: DbTransaction): Promise<void>;
  insertMovements(rows: readonly StockMovementRow[], tx: DbTransaction): Promise<void>;
  findBalance(productId: string, executor: DbExecutor | undefined): Promise<StockBalance>;
  findBalancesByProductIds(
    productIds: readonly string[],
    executor?: DbExecutor,
  ): Promise<Map<string, StockBalance>>;
  /** Chronological movements for one product (`documentDate ASC, createdAt ASC, id ASC`). */
  listMovementsByProduct(productId: string): Promise<LedgerMovementInput[]>;
};
