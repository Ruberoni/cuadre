import { KARDEX_PAGE_SIZE, type StockMovementReferenceType } from "@cuadre/contracts";
import {
  err,
  type Money,
  ok,
  quantityToString,
  type Result,
  scaledQuantityToString,
} from "@cuadre/shared-kernel";
import { buildStockLedger, deriveRoundedAverageCostUsd } from "../domain/stock.ts";
import type {
  InventoryRepository,
  KardexLookups,
  KardexProductRef,
} from "./inventory-repository.ts";

export type GetKardexError = "NOT_FOUND";

export type KardexViewEntry = {
  readonly id: string;
  readonly documentDate: string;
  readonly direction: "INBOUND" | "OUTBOUND";
  readonly quantity: string;
  readonly unitCost: Money;
  readonly averageCostAfter: Money | null;
  readonly onHandAfter: string;
  readonly referenceType: StockMovementReferenceType;
  readonly referenceId: string;
  readonly referenceNumber: string | null;
};

export type KardexPage = {
  readonly product: KardexProductRef;
  readonly onHand: string;
  readonly averageCost: Money | null;
  readonly items: readonly KardexViewEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
};

export type GetKardexResult = Result<KardexPage, GetKardexError>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getKardexUseCase(
  repository: Pick<InventoryRepository, "listMovementsByProduct">,
  lookups: KardexLookups,
  input: { readonly productId: string; readonly page: number },
): Promise<GetKardexResult> {
  if (!UUID_PATTERN.test(input.productId)) return err("NOT_FOUND");

  const product = await lookups.findProductById(input.productId);
  if (product === null) return err("NOT_FOUND");

  const movements = await repository.listMovementsByProduct(product.id);
  const ledger = buildStockLedger(product.id, movements);
  if (!ledger.ok) {
    throw new Error(`Stock ledger for product ${product.id} is inconsistent: ${ledger.error}`);
  }

  const total = ledger.value.entries.length;
  const start = (input.page - 1) * KARDEX_PAGE_SIZE;
  const pageEntries = ledger.value.entries.slice(start, start + KARDEX_PAGE_SIZE);

  const goodsReceiptIds = pageEntries
    .filter((entry) => entry.referenceType === "GOODS_RECEIPT")
    .map((entry) => entry.referenceId);
  const invoiceNumbers =
    goodsReceiptIds.length > 0 && lookups.findGoodsReceiptInvoiceNumbersByIds !== undefined
      ? await lookups.findGoodsReceiptInvoiceNumbersByIds(goodsReceiptIds)
      : new Map<string, string>();

  const items: KardexViewEntry[] = pageEntries.map((entry) => {
    if (entry.referenceType !== "GOODS_RECEIPT") {
      throw new Error(`Unsupported stock movement reference type: ${entry.referenceType}`);
    }
    return {
      id: entry.id,
      documentDate: entry.documentDate,
      direction: entry.direction,
      quantity: quantityToString(entry.quantity),
      unitCost: entry.unitCostUsd,
      averageCostAfter: entry.averageCostAfterUsd,
      onHandAfter: scaledQuantityToString(entry.onHandAfterScaled),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceNumber: invoiceNumbers.get(entry.referenceId) ?? null,
    };
  });

  return ok({
    product,
    onHand: scaledQuantityToString(ledger.value.finalBalance.onHandScaled),
    averageCost: deriveRoundedAverageCostUsd(ledger.value.finalBalance),
    items,
    total,
    page: input.page,
    pageSize: KARDEX_PAGE_SIZE,
  });
}
