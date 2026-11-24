import type { CreateCustomerResult } from "../application/create-customer.ts";
import type { CreateSupplierResult } from "../application/create-supplier.ts";

type CreateSupplierError = Extract<CreateSupplierResult, { ok: false }>["error"];
type CreateCustomerError = Extract<CreateCustomerResult, { ok: false }>["error"];

/**
 * Exhaustive maps from use-case failure code to HTTP status (ADR-009). Adding a failure to a use
 * case without mapping it here fails to compile.
 */
export const CREATE_SUPPLIER_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  RIF_ALREADY_EXISTS: 409,
  PARTNER_ALREADY_EXISTS: 409,
} as const satisfies Record<CreateSupplierError, 400 | 409>;

export const CREATE_CUSTOMER_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  RIF_ALREADY_EXISTS: 409,
  PARTNER_ALREADY_EXISTS: 409,
} as const satisfies Record<CreateCustomerError, 400 | 409>;
