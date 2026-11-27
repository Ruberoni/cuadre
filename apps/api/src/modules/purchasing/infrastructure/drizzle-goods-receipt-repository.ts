import {
  type Currency,
  err,
  money,
  ok,
  parseQuantity,
  quantityToString,
  type Rate,
  rateToString,
} from "@cuadre/shared-kernel";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db, DbTransaction } from "../../../db/client.ts";
import { postgresError, UNIQUE_VIOLATION } from "../../../db/postgres-error.ts";
import type { GoodsReceiptRepository } from "../application/goods-receipt-repository.ts";
import {
  reconstituteGoodsReceipt,
  type StoredGoodsReceipt,
  type StoredGoodsReceiptLine,
  type ValidatedDraftGoodsReceipt,
} from "../domain/goods-receipt.ts";
import { goodsReceiptLinesTable, goodsReceiptsTable } from "./goods-receipts.table.ts";

type ReceiptRow = typeof goodsReceiptsTable.$inferSelect;
type LineRow = typeof goodsReceiptLinesTable.$inferSelect;

function toStoredLine(row: LineRow, currency: Currency): StoredGoodsReceiptLine {
  const quantity = parseQuantity(row.quantity, { allowDecimals: true });
  const unitCost = money(row.unitCostMinor, currency);
  if (!quantity.ok || !unitCost.ok) {
    throw new Error(`Goods receipt line ${row.id} in the database breaks domain rules`);
  }
  return {
    id: row.id,
    position: row.position,
    purchaseOrderLineId: row.purchaseOrderLineId,
    productId: row.productId,
    quantity: quantity.value,
    unitCost: unitCost.value,
  };
}

function toStoredReceipt(row: ReceiptRow, lines: readonly LineRow[]): StoredGoodsReceipt {
  const reconstituted = reconstituteGoodsReceipt({
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    supplierId: row.supplierId,
    currency: row.currency,
    documentDate: row.documentDate,
    supplierInvoiceNumber: row.supplierInvoiceNumber,
    controlNumber: row.controlNumber,
    status: row.status,
    frozenRate: row.frozenRate,
    lines: lines.map((line) => toStoredLine(line, row.currency)),
  });
  if (!reconstituted.ok)
    throw new Error(`Goods receipt ${row.id} in the database breaks domain rules`);
  return reconstituted.value;
}

function lineValues(goodsReceiptId: string, receipt: ValidatedDraftGoodsReceipt) {
  return receipt.lines.map((line) => ({
    goodsReceiptId,
    purchaseOrderLineId: line.purchaseOrderLineId,
    position: line.position,
    productId: line.productId,
    quantity: quantityToString(line.quantity),
    unitCostMinor: line.unitCost.minorUnits,
  }));
}

export function createDrizzleGoodsReceiptRepository(db: Db): GoodsReceiptRepository {
  async function linesOf(executor: Db | DbTransaction, id: string) {
    return executor
      .select()
      .from(goodsReceiptLinesTable)
      .where(eq(goodsReceiptLinesTable.goodsReceiptId, id))
      .orderBy(asc(goodsReceiptLinesTable.position));
  }

  return {
    async insert(receipt) {
      try {
        return await db.transaction(async (tx) => {
          const [header] = await tx
            .insert(goodsReceiptsTable)
            .values({
              purchaseOrderId: receipt.purchaseOrderId,
              supplierId: receipt.supplierId,
              currency: receipt.currency,
              documentDate: receipt.documentDate,
              supplierInvoiceNumber: receipt.supplierInvoiceNumber,
              controlNumber: receipt.controlNumber,
              status: "DRAFT",
            })
            .returning();
          if (header === undefined) throw new Error("Insert goods receipt returned no row");
          const lineRows =
            receipt.lines.length === 0
              ? []
              : await tx
                  .insert(goodsReceiptLinesTable)
                  .values(lineValues(header.id, receipt))
                  .returning();
          return ok(toStoredReceipt(header, lineRows));
        });
      } catch (error) {
        // The unique index on `purchase_order_id` also settles two receipts racing for one order.
        if (postgresError(error).code === UNIQUE_VIOLATION)
          return err("GOODS_RECEIPT_ALREADY_EXISTS");
        throw error;
      }
    },

    async updateDraft(id, receipt) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ status: goodsReceiptsTable.status })
          .from(goodsReceiptsTable)
          .where(eq(goodsReceiptsTable.id, id))
          .for("update")
          .limit(1);
        if (existing === undefined) return err("NOT_FOUND");
        if (existing.status !== "DRAFT") return err("DOCUMENT_NOT_DRAFT");

        const [header] = await tx
          .update(goodsReceiptsTable)
          .set({
            documentDate: receipt.documentDate,
            supplierInvoiceNumber: receipt.supplierInvoiceNumber,
            controlNumber: receipt.controlNumber,
            updatedAt: new Date(),
          })
          .where(and(eq(goodsReceiptsTable.id, id), eq(goodsReceiptsTable.status, "DRAFT")))
          .returning();
        if (header === undefined) return err("DOCUMENT_NOT_DRAFT");

        await tx
          .delete(goodsReceiptLinesTable)
          .where(eq(goodsReceiptLinesTable.goodsReceiptId, id));
        const lineRows =
          receipt.lines.length === 0
            ? []
            : await tx
                .insert(goodsReceiptLinesTable)
                .values(lineValues(header.id, receipt))
                .returning();
        return ok(toStoredReceipt(header, lineRows));
      });
    },

    async deleteDraft(id) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ status: goodsReceiptsTable.status })
          .from(goodsReceiptsTable)
          .where(eq(goodsReceiptsTable.id, id))
          .for("update")
          .limit(1);
        if (existing === undefined) return err("NOT_FOUND");
        if (existing.status !== "DRAFT") return err("DOCUMENT_NOT_DRAFT");

        const [deleted] = await tx
          .delete(goodsReceiptsTable)
          .where(and(eq(goodsReceiptsTable.id, id), eq(goodsReceiptsTable.status, "DRAFT")))
          .returning({ id: goodsReceiptsTable.id });
        if (deleted === undefined) return err("DOCUMENT_NOT_DRAFT");
        return ok(true as const);
      });
    },

    async lockForIssue(id: string, tx: DbTransaction) {
      const [header] = await tx
        .select()
        .from(goodsReceiptsTable)
        .where(eq(goodsReceiptsTable.id, id))
        .for("update")
        .limit(1);
      if (header === undefined) return null;
      return toStoredReceipt(header, await linesOf(tx, header.id));
    },

    async markIssued(id: string, frozenRate: Rate, tx: DbTransaction) {
      const [header] = await tx
        .update(goodsReceiptsTable)
        .set({ status: "ISSUED", frozenRate: rateToString(frozenRate), updatedAt: new Date() })
        .where(and(eq(goodsReceiptsTable.id, id), eq(goodsReceiptsTable.status, "DRAFT")))
        .returning();
      if (header === undefined) {
        throw new Error(`Goods receipt ${id} could not be marked ISSUED (not found or not DRAFT)`);
      }
      return toStoredReceipt(header, await linesOf(tx, header.id));
    },

    async findById(id) {
      const [header] = await db
        .select()
        .from(goodsReceiptsTable)
        .where(eq(goodsReceiptsTable.id, id))
        .limit(1);
      if (header === undefined) return null;
      return toStoredReceipt(header, await linesOf(db, header.id));
    },

    async findByPurchaseOrderId(purchaseOrderId) {
      const [header] = await db
        .select()
        .from(goodsReceiptsTable)
        .where(eq(goodsReceiptsTable.purchaseOrderId, purchaseOrderId))
        .limit(1);
      if (header === undefined) return null;
      return toStoredReceipt(header, await linesOf(db, header.id));
    },

    async findInvoiceNumbersByIds(ids) {
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length === 0) return new Map();
      const rows = await db
        .select({
          id: goodsReceiptsTable.id,
          supplierInvoiceNumber: goodsReceiptsTable.supplierInvoiceNumber,
        })
        .from(goodsReceiptsTable)
        .where(inArray(goodsReceiptsTable.id, uniqueIds));
      return new Map(rows.map((row) => [row.id, row.supplierInvoiceNumber]));
    },

    async list(params) {
      const [headers, totals] = await Promise.all([
        db
          .select()
          .from(goodsReceiptsTable)
          .orderBy(desc(goodsReceiptsTable.documentDate), desc(goodsReceiptsTable.createdAt))
          .limit(params.pageSize)
          .offset((params.page - 1) * params.pageSize),
        db.select({ total: count() }).from(goodsReceiptsTable),
      ]);
      const total = totals[0]?.total ?? 0;
      if (headers.length === 0) return { items: [], total };

      const items = await Promise.all(
        headers.map(async (header) => toStoredReceipt(header, await linesOf(db, header.id))),
      );
      return { items, total };
    },
  };
}
