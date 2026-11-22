import type { CreateSupplierResult } from "../application/create-supplier.ts";

type CreateSupplierError = Extract<CreateSupplierResult, { ok: false }>["error"];

/**
 * Exhaustive map from use-case failure code to HTTP status (ADR-009). Adding a failure to the use
 * case without mapping it here fails to compile.
 */
export const CREATE_SUPPLIER_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  RIF_ALREADY_EXISTS: 409,
} as const satisfies Record<CreateSupplierError, 400 | 409>;
