import { z } from "zod";

// Rule constants: the single source for the domain, the API and the web form.
export const PARTNER_NAME_MAX_LENGTH = 120;
export const PARTNER_PHONE_MAX_LENGTH = 30;
export const PARTNER_EMAIL_MAX_LENGTH = 120;
export const PARTNER_ADDRESS_MAX_LENGTH = 250;
export const PARTNERS_PAGE_SIZE = 25;

export const PARTNER_ROLES = ["supplier", "customer"] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];

export const PARTNER_FIELDS = ["rif", "name", "phone", "email", "address"] as const;
export type PartnerField = (typeof PARTNER_FIELDS)[number];

export const PARTNER_ISSUE_CODES = [
  "REQUIRED",
  "INVALID_FORMAT",
  "INVALID_CHECK_DIGIT",
  "TOO_LONG",
  "INVALID",
] as const;
export type PartnerIssueCode = (typeof PARTNER_ISSUE_CODES)[number];

/**
 * Wire shape only; business rules (RIF normalisation/check digit, lengths, email) are enforced by
 * the domain. `confirmExistingPartner` allows adding a role to a partner that already exists for
 * the other role without overwriting its existing legal name or contact fields.
 */
export const CreatePartnerRequest = z.object({
  rif: z.string(),
  name: z.string(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  address: z.string().nullish(),
  confirmExistingPartner: z.boolean().optional(),
});
export type CreatePartnerRequest = z.infer<typeof CreatePartnerRequest>;

export const Partner = z.object({
  id: z.uuid(),
  rif: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
});
export type Partner = z.infer<typeof Partner>;

export const PARTNER_SORT_FIELDS = ["name", "rif"] as const;
export type PartnerSortField = (typeof PARTNER_SORT_FIELDS)[number];

export const ListPartnersQuery = z.object({
  q: z.string().optional(),
  sort: z.enum(PARTNER_SORT_FIELDS).default("name"),
  order: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
});
export type ListPartnersQuery = z.infer<typeof ListPartnersQuery>;

export const ListPartnersResponse = z.object({
  items: z.array(Partner),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ListPartnersResponse = z.infer<typeof ListPartnersResponse>;
