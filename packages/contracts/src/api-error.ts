import { z } from "zod";

/** Every error code the API can answer with; the web message catalog covers each of them. */
export const API_ERROR_CODES = [
  "VALIDATION_ERROR",
  "SKU_ALREADY_EXISTS",
  "RIF_ALREADY_EXISTS",
  "PARTNER_ALREADY_EXISTS",
  "RATE_ALREADY_EXISTS",
  "RATE_DATE_TOO_FAR",
  "RATE_ALREADY_FROZEN",
  "MISSING_EXCHANGE_RATE",
  "DOCUMENT_NOT_DRAFT",
  "NOT_FOUND",
  /** No valid session (none, expired or signed out). The web goes to Login; never shown. */
  "UNAUTHORIZED",
  /** Signed in, but the user's role may not call this route (PLAN → Roles). */
  "FORBIDDEN",
  "INTERNAL_ERROR",
] as const;
export const ApiErrorCode = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

/** One problem with one input field; `code` says which rule failed (e.g. `REQUIRED`). */
export const FieldIssue = z.object({ field: z.string(), code: z.string() });
export type FieldIssue = z.infer<typeof FieldIssue>;

/** Body of every non-2xx answer. */
export const ApiError = z.object({
  code: ApiErrorCode,
  /** `VALIDATION_ERROR` only. */
  issues: z.array(FieldIssue).optional(),
  /** `SKU_ALREADY_EXISTS` only: the code as stored (normalised), so clients show it as is. */
  sku: z.string().optional(),
  /** `RIF_ALREADY_EXISTS` and `PARTNER_ALREADY_EXISTS`: the RIF as stored (normalised), so clients show it as is. */
  rif: z.string().optional(),
  /** `PARTNER_ALREADY_EXISTS` only: the existing partner's legal name. */
  partnerName: z.string().optional(),
  /** Exchange-rate errors (`RATE_ALREADY_EXISTS`, `RATE_DATE_TOO_FAR`, `RATE_ALREADY_FROZEN`, `MISSING_EXCHANGE_RATE`): `YYYY-MM-DD`. */
  date: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
