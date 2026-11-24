import type { Role } from "../auth/session.ts";
import {
  CreatePartnerRequest,
  ListPartnersQuery,
  ListPartnersResponse,
  PARTNER_FIELDS,
  PARTNER_ISSUE_CODES,
  PARTNER_SORT_FIELDS,
  PARTNERS_PAGE_SIZE,
  Partner,
  type PartnerField,
  type PartnerIssueCode,
  type PartnerSortField,
} from "./partners.ts";

export const SUPPLIERS_PAGE_SIZE = PARTNERS_PAGE_SIZE;

/**
 * Who may call the supplier routes (PLAN → Roles): `admin` and `purchasing` write; `sales` and
 * `warehouse` have no access.
 */
export const SUPPLIER_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ["admin", "purchasing"],
  write: ["admin", "purchasing"],
};

export const SUPPLIER_FIELDS = PARTNER_FIELDS;
export type SupplierField = PartnerField;

export const SUPPLIER_ISSUE_CODES = PARTNER_ISSUE_CODES;
export type SupplierIssueCode = PartnerIssueCode;

export const CreateSupplierRequest = CreatePartnerRequest;
export type CreateSupplierRequest = CreatePartnerRequest;

export const Supplier = Partner;
export type Supplier = Partner;

export const SUPPLIER_SORT_FIELDS = PARTNER_SORT_FIELDS;
export type SupplierSortField = PartnerSortField;

export const ListSuppliersQuery = ListPartnersQuery;
export type ListSuppliersQuery = ListPartnersQuery;

export const ListSuppliersResponse = ListPartnersResponse;
export type ListSuppliersResponse = ListPartnersResponse;
