import { z } from "zod";
import type { Role } from "../auth/session.ts";

// Rule constants: the single source for the domain, the API and the web form.
export const PARTNER_NAME_MAX_LENGTH = 120;
export const PARTNER_PHONE_MAX_LENGTH = 30;
export const PARTNER_EMAIL_MAX_LENGTH = 120;
export const PARTNER_ADDRESS_MAX_LENGTH = 250;
export const SUPPLIERS_PAGE_SIZE = 25;

/**
 * Who may call the supplier routes (PLAN → Roles): `admin` and `purchasing` write; `sales` and
 * `warehouse` have no access.
 */
export const SUPPLIER_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ["admin", "purchasing"],
  write: ["admin", "purchasing"],
};

export const SUPPLIER_FIELDS = ["rif", "name", "phone", "email", "address"] as const;
export type SupplierField = (typeof SUPPLIER_FIELDS)[number];

export const SUPPLIER_ISSUE_CODES = [
  "REQUIRED",
  "INVALID_FORMAT",
  "INVALID_CHECK_DIGIT",
  "TOO_LONG",
  "INVALID",
] as const;
export type SupplierIssueCode = (typeof SUPPLIER_ISSUE_CODES)[number];

/** Wire shape only; the business rules (RIF normalisation/check digit, lengths, email) are enforced by the domain. */
export const CreateSupplierRequest = z.object({
  rif: z.string(),
  name: z.string(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
});
export type CreateSupplierRequest = z.infer<typeof CreateSupplierRequest>;

export const Supplier = z.object({
  id: z.uuid(),
  rif: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});
export type Supplier = z.infer<typeof Supplier>;

export const SUPPLIER_SORT_FIELDS = ["name", "rif"] as const;
export type SupplierSortField = (typeof SUPPLIER_SORT_FIELDS)[number];

export const ListSuppliersQuery = z.object({
  q: z.string().optional(),
  sort: z.enum(SUPPLIER_SORT_FIELDS).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListSuppliersQuery = z.infer<typeof ListSuppliersQuery>;

export const ListSuppliersResponse = z.object({
  items: z.array(Supplier),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListSuppliersResponse = z.infer<typeof ListSuppliersResponse>;
