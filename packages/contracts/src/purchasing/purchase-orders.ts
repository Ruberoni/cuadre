import { z } from "zod";
import type { Role } from "../auth/session.ts";
import { TAX_RATES, UNITS_OF_MEASURE } from "../catalog/products.ts";
import { CurrencySchema, MoneyDto } from "../money.ts";

export const PURCHASE_ORDERS_PAGE_SIZE = 25;

/** Document lifecycle states (ADR-013, GLOSSARY). */
export const DOCUMENT_STATUSES = ["DRAFT", "ISSUED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/**
 * Who may call the purchase-order routes (PLAN → Roles):
 * `admin` and `purchasing` write; `warehouse` reads; `sales` has no access.
 */
export const PURCHASE_ORDER_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ["admin", "purchasing", "warehouse"],
  write: ["admin", "purchasing"],
};

export const PURCHASE_ORDER_ISSUE_CODES = [
  "REQUIRED",
  "INVALID",
  "INVALID_DATE",
  "DOCUMENT_DATE_IN_FUTURE",
  "INVALID_FORMAT",
  "NOT_POSITIVE",
  "OUT_OF_RANGE",
  "QUANTITY_NOT_WHOLE",
  "QUANTITY_TOO_PRECISE",
  "CURRENCY_MISMATCH",
  "NOT_FOUND",
] as const;
export type PurchaseOrderIssueCode = (typeof PURCHASE_ORDER_ISSUE_CODES)[number];

export const PurchaseOrderIdParam = z.object({
  id: z.string(),
});
export type PurchaseOrderIdParam = z.infer<typeof PurchaseOrderIdParam>;

export const PurchaseOrderLineInput = z.object({
  productId: z.string(),
  /** Canonical dot-decimal string (e.g. `"100"`, `"12.345"`), never a float. */
  quantity: z.string(),
  unitCost: MoneyDto,
});
export type PurchaseOrderLineInput = z.infer<typeof PurchaseOrderLineInput>;

/** Wire shape for creating or updating a draft purchase order. Empty `lines` is allowed in Draft. */
export const SavePurchaseOrderRequest = z.object({
  supplierId: z.string(),
  currency: CurrencySchema,
  documentDate: z.string(),
  lines: z.array(PurchaseOrderLineInput),
});
export type SavePurchaseOrderRequest = z.infer<typeof SavePurchaseOrderRequest>;

export const PurchaseOrderSupplier = z.object({
  id: z.uuid(),
  rif: z.string(),
  name: z.string(),
});
export type PurchaseOrderSupplier = z.infer<typeof PurchaseOrderSupplier>;

export const PurchaseOrderLine = z.object({
  id: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  taxRate: z.enum(TAX_RATES),
  quantity: z.string(),
  unitCost: MoneyDto,
  lineTotal: MoneyDto,
});
export type PurchaseOrderLine = z.infer<typeof PurchaseOrderLine>;

export const PurchaseOrderTotals = z.object({
  subtotal: MoneyDto,
  ivaByRate: z.object({
    general: MoneyDto,
    reduced: MoneyDto,
    exempt: MoneyDto,
  }),
  ivaTotal: MoneyDto,
  total: MoneyDto,
});
export type PurchaseOrderTotals = z.infer<typeof PurchaseOrderTotals>;

export const PurchaseOrder = z.object({
  id: z.uuid(),
  supplier: PurchaseOrderSupplier,
  currency: CurrencySchema,
  documentDate: z.string(),
  status: z.enum(DOCUMENT_STATUSES),
  frozenRate: z.string().nullable(),
  lines: z.array(PurchaseOrderLine),
  totals: PurchaseOrderTotals,
  vesTotalEquivalent: MoneyDto.nullable(),
});
export type PurchaseOrder = z.infer<typeof PurchaseOrder>;

export const PurchaseOrderSummary = z.object({
  id: z.uuid(),
  supplier: PurchaseOrderSupplier,
  currency: CurrencySchema,
  documentDate: z.string(),
  status: z.enum(DOCUMENT_STATUSES),
  frozenRate: z.string().nullable(),
  lineCount: z.number().int().min(0),
  totals: PurchaseOrderTotals,
  vesTotalEquivalent: MoneyDto.nullable(),
});
export type PurchaseOrderSummary = z.infer<typeof PurchaseOrderSummary>;

export const ListPurchaseOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
});
export type ListPurchaseOrdersQuery = z.infer<typeof ListPurchaseOrdersQuery>;

export const ListPurchaseOrdersResponse = z.object({
  items: z.array(PurchaseOrderSummary),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListPurchaseOrdersResponse = z.infer<typeof ListPurchaseOrdersResponse>;
