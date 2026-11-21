import { z } from "zod";
import { ROLES, type Role } from "../auth/session.ts";
import { MoneyDto } from "../money.ts";

// Rule constants: the single source for the domain, the API and the web form.
export const SKU_MAX_LENGTH = 20;
/** Letters, digits and hyphens, 1 to 20 characters, no spaces. Case is normalised afterwards. */
export const SKU_PATTERN = new RegExp(`^[A-Za-z0-9-]{1,${SKU_MAX_LENGTH}}$`);
export const PRODUCT_NAME_MAX_LENGTH = 120;
export const PRODUCTS_PAGE_SIZE = 25;

/**
 * Who may call the product routes (PLAN → Roles): the API enforces it on each route, the web hides
 * what a role cannot use with the same lists. Typed as plain role lists so `.includes(role)` works.
 */
export const PRODUCT_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ROLES,
  write: ["admin"],
};

/** Fixed list, in display order (maintainer decision 2026-11-16). */
export const UNITS_OF_MEASURE = ["UNIT", "BOX", "BULK", "KILOGRAM", "LITER"] as const;
export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

/** IVA rates (TaxRate): general 16 %, reduced 8 %, exempt. */
export const TAX_RATES = ["GENERAL", "REDUCED", "EXEMPT"] as const;
export type TaxRate = (typeof TAX_RATES)[number];
export const TAX_RATE_PERCENT: Record<TaxRate, number> = { GENERAL: 16, REDUCED: 8, EXEMPT: 0 };

export const PRODUCT_FIELDS = ["sku", "name", "unitOfMeasure", "salePrice", "taxRate"] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];

export const PRODUCT_ISSUE_CODES = [
  "REQUIRED",
  "INVALID_FORMAT",
  "TOO_LONG",
  "NOT_POSITIVE",
  "OUT_OF_RANGE",
  "INVALID",
] as const;
export type ProductIssueCode = (typeof PRODUCT_ISSUE_CODES)[number];

/** The sale price is in USD, excluding IVA (one price per product). */
const UsdPrice = MoneyDto.extend({ currency: z.literal("USD") });

/** Wire shape only; the business rules (format, length, price > 0) are enforced by the domain. */
export const CreateProductRequest = z.object({
  sku: z.string(),
  name: z.string(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  salePrice: UsdPrice,
  taxRate: z.enum(TAX_RATES),
});
export type CreateProductRequest = z.infer<typeof CreateProductRequest>;

export const Product = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  salePrice: UsdPrice,
  taxRate: z.enum(TAX_RATES),
});
export type Product = z.infer<typeof Product>;

export const PRODUCT_SORT_FIELDS = ["sku", "name", "salePrice"] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const ListProductsQuery = z.object({
  q: z.string().optional(),
  sort: z.enum(PRODUCT_SORT_FIELDS).default("sku"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuery>;

export const ListProductsResponse = z.object({
  items: z.array(Product),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListProductsResponse = z.infer<typeof ListProductsResponse>;
