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

export const CUSTOMERS_PAGE_SIZE = PARTNERS_PAGE_SIZE;

/**
 * Who may call the customer routes (PLAN → Roles): `admin` and `sales` write; `purchasing` and
 * `warehouse` have no access.
 */
export const CUSTOMER_ROLES: Readonly<Record<"read" | "write", readonly Role[]>> = {
  read: ["admin", "sales"],
  write: ["admin", "sales"],
};

export const CUSTOMER_FIELDS = PARTNER_FIELDS;
export type CustomerField = PartnerField;

export const CUSTOMER_ISSUE_CODES = PARTNER_ISSUE_CODES;
export type CustomerIssueCode = PartnerIssueCode;

export const CreateCustomerRequest = CreatePartnerRequest;
export type CreateCustomerRequest = CreatePartnerRequest;

export const Customer = Partner;
export type Customer = Partner;

export const CUSTOMER_SORT_FIELDS = PARTNER_SORT_FIELDS;
export type CustomerSortField = PartnerSortField;

export const ListCustomersQuery = ListPartnersQuery;
export type ListCustomersQuery = ListPartnersQuery;

export const ListCustomersResponse = ListPartnersResponse;
export type ListCustomersResponse = ListPartnersResponse;
