import type { GetKardexError } from "../application/get-kardex.ts";

/** Exhaustive HTTP status map for inventory routes (ADR-009). */
export const GET_KARDEX_ERROR_STATUS = {
  NOT_FOUND: 404,
} as const satisfies Record<GetKardexError, 404>;
