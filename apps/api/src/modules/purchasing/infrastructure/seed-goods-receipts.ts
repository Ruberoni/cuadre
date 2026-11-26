import { addDays, type CalendarDate } from "@cuadre/shared-kernel";
import type { Db } from "../../../db/client.ts";
import type { InventoryModule } from "../../inventory/index.ts";
import { createGoodsReceiptUseCase } from "../application/create-goods-receipt.ts";
import { createPurchaseOrderUseCase } from "../application/create-purchase-order.ts";
import type { GoodsReceiptDeps } from "../application/goods-receipt-repository.ts";
import { issueGoodsReceiptUseCase } from "../application/issue-goods-receipt.ts";
import {
  type IssuePurchaseOrderExchangeRates,
  issuePurchaseOrderUseCase,
} from "../application/issue-purchase-order.ts";
import type { SeedPurchasingSources } from "./seed-purchase-orders.ts";

/**
 * Seeds one issued purchase order dated 3 days ago and its issued goods receipt (partial, with an
 * edited unit cost) through the real use cases, so the demo has stock. Idempotent: skips when any
 * goods receipt exists. The seeded unreceived order of `seedPurchaseOrders` stays open to receive.
 */
export async function seedGoodsReceipts(
  deps: GoodsReceiptDeps & {
    readonly db: Db;
    readonly exchangeRates: IssuePurchaseOrderExchangeRates;
    readonly inventory: Pick<InventoryModule, "recordInboundMovements">;
    readonly orderRepository: Parameters<typeof createPurchaseOrderUseCase>[0];
  },
  sources: SeedPurchasingSources,
  today: CalendarDate,
): Promise<number> {
  if ((await deps.repository.list({ page: 1, pageSize: 1 })).total > 0) return 0;

  const [suppliers, products] = await Promise.all([
    sources.listSuppliers(),
    sources.listProducts(),
  ]);
  const andinaId = suppliers.find((s) => s.rif === "J-30123456-1")?.id;
  const harinaId = products.find((p) => p.sku === "HAR-PAN-1K")?.id;
  const atunId = products.find((p) => p.sku === "ATU-LAT-170")?.id;
  if (!andinaId || !harinaId || !atunId) return 0;

  const orderDate = addDays(today, -3);
  const draft = await createPurchaseOrderUseCase(
    deps.orderRepository,
    deps.lookups,
    {
      supplierId: andinaId,
      currency: "USD",
      documentDate: orderDate,
      lines: [
        { productId: harinaId, quantity: "60", unitCost: { minorUnits: 110, currency: "USD" } },
        { productId: atunId, quantity: "40", unitCost: { minorUnits: 200, currency: "USD" } },
      ],
    },
    today,
  );
  if (!draft.ok) throw new Error(`Demo received order failed validation: ${JSON.stringify(draft)}`);
  const issuedOrder = await issuePurchaseOrderUseCase(
    {
      db: deps.db,
      repository: deps.orderRepository,
      lookups: deps.lookups,
      exchangeRates: deps.exchangeRates,
    },
    draft.value.order.id,
    today,
  );
  if (!issuedOrder.ok)
    throw new Error(`Demo received order failed issue: ${JSON.stringify(issuedOrder)}`);

  const [harinaLine, atunLine] = issuedOrder.value.order.lines;
  if (harinaLine === undefined || atunLine === undefined)
    throw new Error("Demo order lost its lines");

  const receipt = await createGoodsReceiptUseCase(
    deps,
    {
      purchaseOrderId: issuedOrder.value.order.id,
      documentDate: orderDate,
      supplierInvoiceNumber: "F-00012345",
      controlNumber: "00-00012345",
      lines: [
        // 50 of the 60 ordered, invoiced at $1,12 instead of the ordered $1,10.
        {
          purchaseOrderLineId: harinaLine.id,
          quantity: "50",
          unitCost: { minorUnits: 112, currency: "USD" },
        },
        {
          purchaseOrderLineId: atunLine.id,
          quantity: "40",
          unitCost: { minorUnits: 200, currency: "USD" },
        },
      ],
    },
    today,
  );
  if (!receipt.ok)
    throw new Error(`Demo goods receipt failed validation: ${JSON.stringify(receipt)}`);
  const issued = await issueGoodsReceiptUseCase(deps, receipt.value.receipt.id, today);
  if (!issued.ok) throw new Error(`Demo goods receipt failed issue: ${JSON.stringify(issued)}`);
  return 1;
}
