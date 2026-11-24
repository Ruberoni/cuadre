import { addDays, type CalendarDate } from "@cuadre/shared-kernel";
import { createPurchaseOrderUseCase } from "../application/create-purchase-order.ts";
import type {
  PurchaseOrderRepository,
  PurchasingLookups,
} from "../application/purchase-order-repository.ts";

export type SeedPurchasingSources = {
  readonly listSuppliers: () => Promise<readonly { id: string; rif: string }[]>;
  readonly listProducts: () => Promise<readonly { id: string; sku: string }[]>;
};

/**
 * Seeds 2 realistic demo draft purchase orders through the real use case.
 * Idempotent: skips if any purchase orders already exist.
 */
export async function seedPurchaseOrders(
  repository: PurchaseOrderRepository,
  lookups: PurchasingLookups,
  sources: SeedPurchasingSources,
  today: CalendarDate,
): Promise<number> {
  if ((await repository.count()) > 0) return 0;

  const [suppliers, products] = await Promise.all([
    sources.listSuppliers(),
    sources.listProducts(),
  ]);
  const supplierByRif = new Map(suppliers.map((s) => [s.rif, s.id]));
  const productBySku = new Map(products.map((p) => [p.sku, p.id]));

  const andinaId = supplierByRif.get("J-30123456-1");
  const surId = supplierByRif.get("J-40234567-4");
  const harinaId = productBySku.get("HAR-PAN-1K");
  const atunId = productBySku.get("ATU-LAT-170");
  const polloId = productBySku.get("POL-FRE-KG");

  if (!andinaId || !surId || !harinaId || !atunId || !polloId) {
    return 0;
  }

  let created = 0;
  const drafts = [
    {
      supplierId: andinaId,
      currency: "USD" as const,
      documentDate: today,
      lines: [
        {
          productId: harinaId,
          quantity: "100",
          unitCost: { minorUnits: 110, currency: "USD" as const },
        },
        {
          productId: atunId,
          quantity: "50",
          unitCost: { minorUnits: 200, currency: "USD" as const },
        },
      ],
    },
    {
      supplierId: surId,
      currency: "VES" as const,
      documentDate: addDays(today, -1),
      lines: [
        {
          productId: polloId,
          quantity: "12.5",
          unitCost: { minorUnits: 18500, currency: "VES" as const },
        },
      ],
    },
  ];

  for (const draft of drafts) {
    const result = await createPurchaseOrderUseCase(repository, lookups, draft, today);
    if (!result.ok) {
      throw new Error(`Demo purchase order failed validation: ${JSON.stringify(result)}`);
    }
    created += 1;
  }

  return created;
}
