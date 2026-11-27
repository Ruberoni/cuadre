import { z } from "zod";
import type { Role } from "../auth/session.ts";
import { UNITS_OF_MEASURE } from "../catalog/products.ts";
import { MoneyDto } from "../money.ts";

export const KARDEX_PAGE_SIZE = 50;

/**
 * Who may read the stock ledger (PLAN → Roles): admin, purchasing and warehouse.
 * Sales reads on-hand only (through the Products list) and is refused with 403 on the kardex API.
 */
export const KARDEX_ROLES: Readonly<Record<"read", readonly Role[]>> = {
  read: ["admin", "purchasing", "warehouse"],
};

export const STOCK_MOVEMENT_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type StockMovementDirection = (typeof STOCK_MOVEMENT_DIRECTIONS)[number];

export const STOCK_MOVEMENT_REFERENCE_TYPES = ["GOODS_RECEIPT"] as const;
export type StockMovementReferenceType = (typeof STOCK_MOVEMENT_REFERENCE_TYPES)[number];

const UsdMoney = MoneyDto.extend({ currency: z.literal("USD") });

export const KardexProductParam = z.object({
  productId: z.uuid(),
});
export type KardexProductParam = z.infer<typeof KardexProductParam>;

export const GetKardexQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
});
export type GetKardexQuery = z.infer<typeof GetKardexQuery>;

export const KardexProduct = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
});
export type KardexProduct = z.infer<typeof KardexProduct>;

export const KardexEntry = z.object({
  id: z.uuid(),
  /** Calendar date `YYYY-MM-DD` of the source document. */
  documentDate: z.string(),
  direction: z.enum(STOCK_MOVEMENT_DIRECTIONS),
  /** Canonical dot-decimal string without trailing fractional zeros (e.g. `"10"`, `"150.5"`). */
  quantity: z.string(),
  /** Unit cost in USD, excluding IVA. */
  unitCost: UsdMoney,
  /** Weighted average cost in USD after this movement; `null` when stock reaches zero. */
  averageCostAfter: UsdMoney.nullable(),
  /** On-hand quantity after this movement as canonical dot-decimal string. */
  onHandAfter: z.string(),
  referenceType: z.enum(STOCK_MOVEMENT_REFERENCE_TYPES),
  referenceId: z.uuid(),
  /** Human identifier of the source document (e.g. supplier invoice number for a goods receipt). */
  referenceNumber: z.string().nullable(),
});
export type KardexEntry = z.infer<typeof KardexEntry>;

export const KardexResponse = z.object({
  product: KardexProduct,
  /** Current on-hand quantity as canonical dot-decimal string (`"0"` when empty). */
  onHand: z.string(),
  /** Current weighted average cost in USD; `null` when nothing is on hand. */
  averageCost: UsdMoney.nullable(),
  items: z.array(KardexEntry),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type KardexResponse = z.infer<typeof KardexResponse>;
