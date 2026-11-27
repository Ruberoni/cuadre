import { z } from "zod";
import type { Role } from "../auth/session.ts";
import { TAX_RATES, UNITS_OF_MEASURE } from "../catalog/products.ts";
import { CurrencySchema, MoneyDto } from "../money.ts";
import { DocumentTotals } from "./document-totals.ts";
import { DOCUMENT_STATUSES } from "./purchase-orders.ts";

export const GOODS_RECEIPTS_PAGE_SIZE = 25;
export const SUPPLIER_INVOICE_NUMBER_MAX_LENGTH = 50;
export const CONTROL_NUMBER_MAX_LENGTH = 50;

/**
 * Who may call the goods-receipt routes (PLAN → Roles): `admin` and `warehouse` write;
 * `purchasing` reads; `sales` has no access.
 */
export const GOODS_RECEIPT_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ["admin", "purchasing", "warehouse"],
  write: ["admin", "warehouse"],
};

export const GOODS_RECEIPT_ISSUE_CODES = [
  "REQUIRED",
  "INVALID",
  "INVALID_DATE",
  "DOCUMENT_DATE_IN_FUTURE",
  "INVALID_FORMAT",
  "NOT_POSITIVE",
  "OUT_OF_RANGE",
  "AMOUNT_OUT_OF_RANGE",
  "QUANTITY_NOT_WHOLE",
  "QUANTITY_TOO_PRECISE",
  "QUANTITY_EXCEEDS_ORDERED",
  "CURRENCY_MISMATCH",
  "NOT_FOUND",
  "TOO_LONG",
  "DUPLICATE_LINE",
] as const;
export type GoodsReceiptIssueCode = (typeof GOODS_RECEIPT_ISSUE_CODES)[number];

export const GoodsReceiptIdParam = z.object({ id: z.string() });
export type GoodsReceiptIdParam = z.infer<typeof GoodsReceiptIdParam>;

export const GoodsReceiptLineInput = z.object({
  /** The order line this receipt line receives (1:1 with the order's lines; some may be left out). */
  purchaseOrderLineId: z.string(),
  /** Canonical dot-decimal string, never a float; at most the ordered quantity. */
  quantity: z.string(),
  /** Defaults from the order and may be edited to match the supplier's invoice. */
  unitCost: MoneyDto,
});
export type GoodsReceiptLineInput = z.infer<typeof GoodsReceiptLineInput>;

const GoodsReceiptBody = {
  documentDate: z.string(),
  supplierInvoiceNumber: z.string(),
  controlNumber: z.string(),
  lines: z.array(GoodsReceiptLineInput),
};

export const CreateGoodsReceiptRequest = z.object({
  purchaseOrderId: z.string(),
  ...GoodsReceiptBody,
});
export type CreateGoodsReceiptRequest = z.infer<typeof CreateGoodsReceiptRequest>;

export const UpdateGoodsReceiptRequest = z.object(GoodsReceiptBody);
export type UpdateGoodsReceiptRequest = z.infer<typeof UpdateGoodsReceiptRequest>;

export const GoodsReceiptLine = z.object({
  id: z.uuid(),
  purchaseOrderLineId: z.uuid(),
  productId: z.uuid(),
  productSku: z.string(),
  productName: z.string(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  taxRate: z.enum(TAX_RATES),
  orderedQuantity: z.string(),
  quantity: z.string(),
  unitCost: MoneyDto,
  lineTotal: MoneyDto,
});
export type GoodsReceiptLine = z.infer<typeof GoodsReceiptLine>;

export const GoodsReceiptTotals = DocumentTotals;
export type GoodsReceiptTotals = DocumentTotals;

export const GoodsReceiptPurchaseOrderRef = z.object({
  id: z.uuid(),
  documentDate: z.string(),
});

export const GoodsReceiptSupplier = z.object({
  id: z.uuid(),
  rif: z.string(),
  name: z.string(),
});

export const GoodsReceipt = z.object({
  id: z.uuid(),
  purchaseOrder: GoodsReceiptPurchaseOrderRef,
  supplier: GoodsReceiptSupplier,
  currency: CurrencySchema,
  documentDate: z.string(),
  supplierInvoiceNumber: z.string(),
  controlNumber: z.string(),
  status: z.enum(DOCUMENT_STATUSES),
  frozenRate: z.string().nullable(),
  lines: z.array(GoodsReceiptLine),
  totals: GoodsReceiptTotals,
  vesTotalEquivalent: MoneyDto.nullable(),
});
export type GoodsReceipt = z.infer<typeof GoodsReceipt>;

export const GoodsReceiptSummary = z.object({
  id: z.uuid(),
  purchaseOrderId: z.uuid(),
  supplier: GoodsReceiptSupplier,
  currency: CurrencySchema,
  documentDate: z.string(),
  supplierInvoiceNumber: z.string(),
  status: z.enum(DOCUMENT_STATUSES),
  lineCount: z.number().int().min(0),
  totals: GoodsReceiptTotals,
});
export type GoodsReceiptSummary = z.infer<typeof GoodsReceiptSummary>;

export const ListGoodsReceiptsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
});
export type ListGoodsReceiptsQuery = z.infer<typeof ListGoodsReceiptsQuery>;

export const ListGoodsReceiptsResponse = z.object({
  items: z.array(GoodsReceiptSummary),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListGoodsReceiptsResponse = z.infer<typeof ListGoodsReceiptsResponse>;
