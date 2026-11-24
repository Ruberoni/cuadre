import {
  type Currency,
  err,
  money,
  ok,
  parseCalendarDate,
  parseQuantity,
  quantityToString,
} from "@cuadre/shared-kernel";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../../../db/client.ts";
import type { PurchaseOrderRepository } from "../application/purchase-order-repository.ts";
import type {
  StoredPurchaseOrder,
  StoredPurchaseOrderLine,
  ValidatedDraftPurchaseOrder,
} from "../domain/purchase-order.ts";
import { purchaseOrderLinesTable, purchaseOrdersTable } from "./purchase-orders.table.ts";

type OrderRow = typeof purchaseOrdersTable.$inferSelect;
type LineRow = typeof purchaseOrderLinesTable.$inferSelect;

function toStoredLine(row: LineRow, currency: Currency): StoredPurchaseOrderLine {
  const quantity = parseQuantity(row.quantity, { allowDecimals: true });
  const unitCost = money(row.unitCostMinor, currency);
  if (!quantity.ok || !unitCost.ok) {
    throw new Error(`Purchase order line ${row.id} in the database breaks domain rules`);
  }
  return {
    id: row.id,
    position: row.position,
    productId: row.productId,
    quantity: quantity.value,
    unitCost: unitCost.value,
  };
}

function toStoredOrder(row: OrderRow, lines: readonly LineRow[]): StoredPurchaseOrder {
  const documentDate = parseCalendarDate(row.documentDate);
  if (!documentDate.ok) {
    throw new Error(`Purchase order ${row.id} has an invalid documentDate in the database`);
  }
  return {
    id: row.id,
    supplierId: row.supplierId,
    currency: row.currency,
    documentDate: documentDate.value,
    status: row.status,
    lines: lines.map((line) => toStoredLine(line, row.currency)),
  };
}

export function createDrizzlePurchaseOrderRepository(db: Db): PurchaseOrderRepository {
  return {
    async insert(order: ValidatedDraftPurchaseOrder) {
      return db.transaction(async (tx) => {
        const [header] = await tx
          .insert(purchaseOrdersTable)
          .values({
            supplierId: order.supplierId,
            currency: order.currency,
            documentDate: order.documentDate,
            status: "DRAFT",
          })
          .returning();
        if (header === undefined) throw new Error("Insert purchase order returned no row");

        const lineRows =
          order.lines.length === 0
            ? []
            : await tx
                .insert(purchaseOrderLinesTable)
                .values(
                  order.lines.map((line) => ({
                    purchaseOrderId: header.id,
                    position: line.position,
                    productId: line.productId,
                    quantity: quantityToString(line.quantity),
                    unitCostMinor: line.unitCost.minorUnits,
                  })),
                )
                .returning();

        return toStoredOrder(header, lineRows);
      });
    },

    async updateDraft(id: string, order: ValidatedDraftPurchaseOrder) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ status: purchaseOrdersTable.status })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.id, id))
          .limit(1);
        if (existing === undefined) return err("NOT_FOUND");
        if (existing.status !== "DRAFT") return err("DOCUMENT_NOT_DRAFT");

        const [header] = await tx
          .update(purchaseOrdersTable)
          .set({
            supplierId: order.supplierId,
            currency: order.currency,
            documentDate: order.documentDate,
            updatedAt: new Date(),
          })
          .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.status, "DRAFT")))
          .returning();
        if (header === undefined) return err("DOCUMENT_NOT_DRAFT");

        await tx
          .delete(purchaseOrderLinesTable)
          .where(eq(purchaseOrderLinesTable.purchaseOrderId, id));

        const lineRows =
          order.lines.length === 0
            ? []
            : await tx
                .insert(purchaseOrderLinesTable)
                .values(
                  order.lines.map((line) => ({
                    purchaseOrderId: header.id,
                    position: line.position,
                    productId: line.productId,
                    quantity: quantityToString(line.quantity),
                    unitCostMinor: line.unitCost.minorUnits,
                  })),
                )
                .returning();

        return ok(toStoredOrder(header, lineRows));
      });
    },

    async deleteDraft(id: string) {
      return db.transaction(async (tx) => {
        const [existing] = await tx
          .select({ status: purchaseOrdersTable.status })
          .from(purchaseOrdersTable)
          .where(eq(purchaseOrdersTable.id, id))
          .limit(1);
        if (existing === undefined) return err("NOT_FOUND");
        if (existing.status !== "DRAFT") return err("DOCUMENT_NOT_DRAFT");

        const [deleted] = await tx
          .delete(purchaseOrdersTable)
          .where(and(eq(purchaseOrdersTable.id, id), eq(purchaseOrdersTable.status, "DRAFT")))
          .returning({ id: purchaseOrdersTable.id });
        if (deleted === undefined) return err("DOCUMENT_NOT_DRAFT");
        return ok(true);
      });
    },

    async findById(id: string) {
      const [header] = await db
        .select()
        .from(purchaseOrdersTable)
        .where(eq(purchaseOrdersTable.id, id))
        .limit(1);
      if (header === undefined) return null;

      const lines = await db
        .select()
        .from(purchaseOrderLinesTable)
        .where(eq(purchaseOrderLinesTable.purchaseOrderId, header.id))
        .orderBy(asc(purchaseOrderLinesTable.position));

      return toStoredOrder(header, lines);
    },

    async list(params) {
      const [headers, totals] = await Promise.all([
        db
          .select()
          .from(purchaseOrdersTable)
          .orderBy(desc(purchaseOrdersTable.documentDate), desc(purchaseOrdersTable.createdAt))
          .limit(params.pageSize)
          .offset((params.page - 1) * params.pageSize),
        db.select({ total: count() }).from(purchaseOrdersTable),
      ]);

      if (headers.length === 0) {
        return { items: [], total: totals[0]?.total ?? 0 };
      }

      const orderIds = headers.map((header) => header.id);
      const allLines = await db
        .select()
        .from(purchaseOrderLinesTable)
        .where(inArray(purchaseOrderLinesTable.purchaseOrderId, orderIds))
        .orderBy(asc(purchaseOrderLinesTable.position));

      const linesByOrderId = new Map<string, LineRow[]>();
      for (const line of allLines) {
        const list = linesByOrderId.get(line.purchaseOrderId) ?? [];
        list.push(line);
        linesByOrderId.set(line.purchaseOrderId, list);
      }

      return {
        items: headers.map((header) => toStoredOrder(header, linesByOrderId.get(header.id) ?? [])),
        total: totals[0]?.total ?? 0,
      };
    },

    async count() {
      const [row] = await db.select({ total: count() }).from(purchaseOrdersTable);
      return row?.total ?? 0;
    },
  };
}
