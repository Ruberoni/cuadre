import type { CreateGoodsReceiptResult } from "../application/create-goods-receipt.ts";
import type { CreatePurchaseOrderResult } from "../application/create-purchase-order.ts";
import type { DeleteGoodsReceiptResult } from "../application/delete-goods-receipt.ts";
import type { DeletePurchaseOrderResult } from "../application/delete-purchase-order.ts";
import type { GetGoodsReceiptResult } from "../application/get-goods-receipt.ts";
import type { GetPurchaseOrderResult } from "../application/get-purchase-order.ts";
import type { IssueGoodsReceiptResult } from "../application/issue-goods-receipt.ts";
import type { IssuePurchaseOrderResult } from "../application/issue-purchase-order.ts";
import type { UpdateGoodsReceiptResult } from "../application/update-goods-receipt.ts";
import type { UpdatePurchaseOrderResult } from "../application/update-purchase-order.ts";

type CreateFailureCode = Extract<CreatePurchaseOrderResult, { ok: false }>["error"];
type UpdateFailureCode = Extract<UpdatePurchaseOrderResult, { ok: false }>["error"];
type DeleteFailureCode = Extract<DeletePurchaseOrderResult, { ok: false }>["error"];
type GetFailureCode = Extract<GetPurchaseOrderResult, { ok: false }>["error"];
type IssueFailureCode = Extract<IssuePurchaseOrderResult, { ok: false }>["error"];

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

export const ISSUE_PURCHASE_ORDER_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  DOCUMENT_NOT_DRAFT: 409,
  EMPTY_DOCUMENT: 409,
  MISSING_EXCHANGE_RATE: 409,
} as const satisfies Record<IssueFailureCode, 400 | 404 | 409>;

type CreateGoodsReceiptFailureCode = Extract<CreateGoodsReceiptResult, { ok: false }>["error"];
type UpdateGoodsReceiptFailureCode = Extract<UpdateGoodsReceiptResult, { ok: false }>["error"];
type DeleteGoodsReceiptFailureCode = Extract<DeleteGoodsReceiptResult, { ok: false }>["error"];
type GetGoodsReceiptFailureCode = Extract<GetGoodsReceiptResult, { ok: false }>["error"];
type IssueGoodsReceiptFailureCode = Extract<IssueGoodsReceiptResult, { ok: false }>["error"];

export const CREATE_GOODS_RECEIPT_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  GOODS_RECEIPT_ALREADY_EXISTS: 409,
  PURCHASE_ORDER_NOT_ISSUED: 409,
} as const satisfies Record<CreateGoodsReceiptFailureCode, 400 | 409>;

export const UPDATE_GOODS_RECEIPT_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  DOCUMENT_NOT_DRAFT: 409,
  PURCHASE_ORDER_NOT_ISSUED: 409,
} as const satisfies Record<UpdateGoodsReceiptFailureCode, 400 | 404 | 409>;

export const DELETE_GOODS_RECEIPT_ERROR_STATUS = {
  NOT_FOUND: 404,
  DOCUMENT_NOT_DRAFT: 409,
} as const satisfies Record<DeleteGoodsReceiptFailureCode, 404 | 409>;

export const GET_GOODS_RECEIPT_ERROR_STATUS = {
  NOT_FOUND: 404,
} as const satisfies Record<GetGoodsReceiptFailureCode, 404>;

export const ISSUE_GOODS_RECEIPT_ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  DOCUMENT_NOT_DRAFT: 409,
  EMPTY_DOCUMENT: 409,
  PURCHASE_ORDER_NOT_ISSUED: 409,
  MISSING_EXCHANGE_RATE: 409,
} as const satisfies Record<IssueGoodsReceiptFailureCode, 400 | 404 | 409>;
