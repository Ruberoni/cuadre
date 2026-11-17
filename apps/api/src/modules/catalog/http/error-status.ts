import type { CreateProductResult } from "../application/create-product.ts";

type FailureCode = Extract<CreateProductResult, { ok: false }>["error"];

/** Exhaustive: a new failure code of the use case does not compile until it has a status. */
export const CREATE_PRODUCT_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  SKU_ALREADY_EXISTS: 409,
} as const satisfies Record<FailureCode, 400 | 409>;
