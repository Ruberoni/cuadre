import type { CreatePurchaseOrderResult } from "../application/create-purchase-order.ts";
import type { DeletePurchaseOrderResult } from "../application/delete-purchase-order.ts";
import type { GetPurchaseOrderResult } from "../application/get-purchase-order.ts";
import type { UpdatePurchaseOrderResult } from "../application/update-purchase-order.ts";

type CreateFailureCode = Extract<CreatePurchaseOrderResult, { ok: false }>["error"];
type UpdateFailureCode = Extract<UpdatePurchaseOrderResult, { ok: false }>["error"];
type DeleteFailureCode = Extract<DeletePurchaseOrderResult, { ok: false }>["error"];
type GetFailureCode = Extract<GetPurchaseOrderResult, { ok: false }>["error"];

export const CREATE_PURCHASE_ORDER_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
} as const satisfies Record<CreateFailureCode, 400>;

export const UPDATE_PURCHASE_ORDER_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  DOCUMENT_NOT_DRAFT: 409,
} as const satisfies Record<UpdateFailureCode, 400 | 404 | 409>;

export const DELETE_PURCHASE_ORDER_ERROR_STATUS = {
  NOT_FOUND: 404,
  DOCUMENT_NOT_DRAFT: 409,
} as const satisfies Record<DeleteFailureCode, 404 | 409>;

export const GET_PURCHASE_ORDER_ERROR_STATUS = {
  NOT_FOUND: 404,
} as const satisfies Record<GetFailureCode, 404>;
