import {
  ApiError,
  CreateGoodsReceiptRequest,
  GOODS_RECEIPT_ROLES,
  GoodsReceipt,
  GoodsReceiptIdParam,
  type GoodsReceiptSummary,
  ListGoodsReceiptsQuery,
  ListGoodsReceiptsResponse,
  UpdateGoodsReceiptRequest,
} from "@cuadre/contracts";
import { type CalendarDate, quantityToString, rateToString } from "@cuadre/shared-kernel";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import type { Db } from "../../../db/client.ts";
import {
  errorBody,
  forbiddenResponse,
  openApiOptions,
  unauthorizedResponse,
} from "../../../http/api-error.ts";
import type { InventoryModule } from "../../inventory/index.ts";
import { createGoodsReceiptUseCase } from "../application/create-goods-receipt.ts";
import { deleteGoodsReceiptUseCase } from "../application/delete-goods-receipt.ts";
import { getGoodsReceiptUseCase } from "../application/get-goods-receipt.ts";
import type {
  EnrichedGoodsReceipt,
  EnrichedGoodsReceiptSummary,
  GoodsReceiptDeps,
} from "../application/goods-receipt-repository.ts";
import { issueGoodsReceiptUseCase } from "../application/issue-goods-receipt.ts";
import type { IssuePurchaseOrderExchangeRates } from "../application/issue-purchase-order.ts";
import { listGoodsReceiptsUseCase } from "../application/list-goods-receipts.ts";
import { updateGoodsReceiptUseCase } from "../application/update-goods-receipt.ts";
import { toDocumentTotalsDto } from "./document-totals-dto.ts";
import {
  CREATE_GOODS_RECEIPT_ERROR_STATUS,
  DELETE_GOODS_RECEIPT_ERROR_STATUS,
  GET_GOODS_RECEIPT_ERROR_STATUS,
  ISSUE_GOODS_RECEIPT_ERROR_STATUS,
  UPDATE_GOODS_RECEIPT_ERROR_STATUS,
} from "./error-status.ts";

function toGoodsReceiptDto(enriched: EnrichedGoodsReceipt): GoodsReceipt {
  const { receipt, order, supplier } = enriched;
  return {
    id: receipt.id,
    purchaseOrder: { id: order.id, documentDate: order.documentDate },
    supplier: { id: supplier.id, rif: supplier.rif, name: supplier.name },
    currency: receipt.currency,
    documentDate: receipt.documentDate,
    supplierInvoiceNumber: receipt.supplierInvoiceNumber,
    controlNumber: receipt.controlNumber,
    status: receipt.status,
    frozenRate: receipt.frozenRate === null ? null : rateToString(receipt.frozenRate),
    lines: receipt.lines.map((line, index) => {
      const product = enriched.productsById.get(line.productId);
      const orderLine = order.lines.find((candidate) => candidate.id === line.purchaseOrderLineId);
      const lineTotal = enriched.totals.lineTotals[index];
      if (product === undefined || orderLine === undefined || lineTotal === undefined) {
        throw new Error(`Missing product, order line or line total for line ${line.id}`);
      }
      return {
        id: line.id,
        purchaseOrderLineId: line.purchaseOrderLineId,
        productId: line.productId,
        productSku: product.sku,
        productName: product.name,
        unitOfMeasure: product.unitOfMeasure,
        taxRate: product.taxRate,
        orderedQuantity: quantityToString(orderLine.quantity),
        quantity: quantityToString(line.quantity),
        unitCost: { minorUnits: line.unitCost.minorUnits, currency: line.unitCost.currency },
        lineTotal: { minorUnits: lineTotal.minorUnits, currency: lineTotal.currency },
      };
    }),
    totals: toDocumentTotalsDto(enriched.totals),
    vesTotalEquivalent:
      enriched.vesTotalEquivalent === null
        ? null
        : {
            minorUnits: enriched.vesTotalEquivalent.minorUnits,
            currency: enriched.vesTotalEquivalent.currency,
          },
  };
}

function toGoodsReceiptSummaryDto(enriched: EnrichedGoodsReceiptSummary): GoodsReceiptSummary {
  const { receipt, supplier } = enriched;
  return {
    id: receipt.id,
    purchaseOrderId: receipt.purchaseOrderId,
    supplier: { id: supplier.id, rif: supplier.rif, name: supplier.name },
    currency: receipt.currency,
    documentDate: receipt.documentDate,
    supplierInvoiceNumber: receipt.supplierInvoiceNumber,
    status: receipt.status,
    lineCount: receipt.lines.length,
    totals: toDocumentTotalsDto(enriched.totals),
  };
}

const TAGS = ["Purchasing"];

const listGoodsReceiptsRoute = createRoute({
  method: "get",
  path: "/goods-receipts",
  tags: TAGS,
  middleware: [allowRoles(GOODS_RECEIPT_ROLES.read)] as const,
  request: { query: ListGoodsReceiptsQuery },
  responses: {
    200: {
      description: "A page of goods receipts.",
      content: { "application/json": { schema: ListGoodsReceiptsResponse } },
    },
    400: {
      description: "Invalid query parameters.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const getGoodsReceiptRoute = createRoute({
  method: "get",
  path: "/goods-receipts/{id}",
  tags: TAGS,
  middleware: [allowRoles(GOODS_RECEIPT_ROLES.read)] as const,
  request: { params: GoodsReceiptIdParam },
  responses: {
    200: {
      description: "Goods receipt details.",
      content: { "application/json": { schema: GoodsReceipt } },
    },
    404: {
      description: "Goods receipt not found.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const createGoodsReceiptRoute = createRoute({
  method: "post",
  path: "/goods-receipts",
  tags: TAGS,
  middleware: [allowRoles(GOODS_RECEIPT_ROLES.write)] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: CreateGoodsReceiptRequest } },
    },
  },
  responses: {
    201: {
      description: "Draft goods receipt created.",
      content: { "application/json": { schema: GoodsReceipt } },
    },
    400: {
      description: "Invalid goods receipt fields.",
      content: { "application/json": { schema: ApiError } },
    },
    409: {
      description:
        "The purchase order is not issued (`PURCHASE_ORDER_NOT_ISSUED`) or already has a goods receipt (`GOODS_RECEIPT_ALREADY_EXISTS`).",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const updateGoodsReceiptRoute = createRoute({
  method: "put",
  path: "/goods-receipts/{id}",
  tags: TAGS,
  middleware: [allowRoles(GOODS_RECEIPT_ROLES.write)] as const,
  request: {
    params: GoodsReceiptIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: UpdateGoodsReceiptRequest } },
    },
  },
  responses: {
    200: {
      description: "Draft goods receipt updated.",
      content: { "application/json": { schema: GoodsReceipt } },
    },
    400: {
      description: "Invalid goods receipt fields.",
      content: { "application/json": { schema: ApiError } },
    },
    404: {
      description: "Goods receipt not found.",
      content: { "application/json": { schema: ApiError } },
    },
    409: {
      description: "The goods receipt is no longer a draft.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const deleteGoodsReceiptRoute = createRoute({
  method: "delete",
  path: "/goods-receipts/{id}",
  tags: TAGS,
  middleware: [allowRoles(GOODS_RECEIPT_ROLES.write)] as const,
  request: { params: GoodsReceiptIdParam },
  responses: {
    204: { description: "Draft goods receipt deleted." },
    404: {
      description: "Goods receipt not found.",
      content: { "application/json": { schema: ApiError } },
    },
    409: {
      description: "The goods receipt is no longer a draft.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const issueGoodsReceiptRoute = createRoute({
  method: "post",
  path: "/goods-receipts/{id}/issue",
  tags: TAGS,
  middleware: [allowRoles(GOODS_RECEIPT_ROLES.write)] as const,
  request: { params: GoodsReceiptIdParam },
  responses: {
    200: {
      description: "Goods receipt issued: rate frozen, stock raised, purchase order closed.",
      content: { "application/json": { schema: GoodsReceipt } },
    },
    400: {
      description: "Document date is in the future or an amount is out of range.",
      content: { "application/json": { schema: ApiError } },
    },
    404: {
      description: "Goods receipt not found.",
      content: { "application/json": { schema: ApiError } },
    },
    409: {
      description:
        "Cannot be issued (`DOCUMENT_NOT_DRAFT`, `EMPTY_DOCUMENT`, `PURCHASE_ORDER_NOT_ISSUED` or `MISSING_EXCHANGE_RATE`).",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

export function createGoodsReceiptRoutes(
  db: Db,
  deps: GoodsReceiptDeps,
  exchangeRates: IssuePurchaseOrderExchangeRates,
  inventory: Pick<InventoryModule, "recordInboundMovements">,
  today: () => CalendarDate,
): OpenAPIHono {
  const routes = new OpenAPIHono(openApiOptions);

  routes.openapi(listGoodsReceiptsRoute, async (c) => {
    const query = c.req.valid("query");
    const result = await listGoodsReceiptsUseCase(deps.repository, deps.lookups, {
      page: query.page,
    });
    return c.json(
      {
        items: result.items.map(toGoodsReceiptSummaryDto),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
      200,
    );
  });

  routes.openapi(getGoodsReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await getGoodsReceiptUseCase(deps, id);
    if (!result.ok) {
      return c.json(errorBody(result.error), GET_GOODS_RECEIPT_ERROR_STATUS[result.error]);
    }
    return c.json(toGoodsReceiptDto(result.value), 200);
  });

  routes.openapi(createGoodsReceiptRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createGoodsReceiptUseCase(deps, body, today());
    if (!result.ok) {
      if (result.error === "VALIDATION_ERROR") {
        return c.json(
          errorBody(result.error, { issues: result.issues }),
          CREATE_GOODS_RECEIPT_ERROR_STATUS[result.error],
        );
      }
      return c.json(errorBody(result.error), CREATE_GOODS_RECEIPT_ERROR_STATUS[result.error]);
    }
    return c.json(toGoodsReceiptDto(result.value), 201);
  });

  routes.openapi(updateGoodsReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateGoodsReceiptUseCase(deps, id, body, today());
    if (!result.ok) {
      if (result.error === "VALIDATION_ERROR") {
        return c.json(
          errorBody(result.error, { issues: result.issues }),
          UPDATE_GOODS_RECEIPT_ERROR_STATUS[result.error],
        );
      }
      return c.json(errorBody(result.error), UPDATE_GOODS_RECEIPT_ERROR_STATUS[result.error]);
    }
    return c.json(toGoodsReceiptDto(result.value), 200);
  });

  routes.openapi(deleteGoodsReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await deleteGoodsReceiptUseCase(deps.repository, id);
    if (!result.ok) {
      return c.json(errorBody(result.error), DELETE_GOODS_RECEIPT_ERROR_STATUS[result.error]);
    }
    return c.body(null, 204);
  });

  routes.openapi(issueGoodsReceiptRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await issueGoodsReceiptUseCase(
      { ...deps, db, exchangeRates, inventory },
      id,
      today(),
    );
    if (!result.ok) {
      if (result.error === "VALIDATION_ERROR") {
        return c.json(
          errorBody(result.error, { issues: result.issues }),
          ISSUE_GOODS_RECEIPT_ERROR_STATUS[result.error],
        );
      }
      if (result.error === "MISSING_EXCHANGE_RATE") {
        return c.json(
          errorBody(result.error, { date: result.date }),
          ISSUE_GOODS_RECEIPT_ERROR_STATUS[result.error],
        );
      }
      return c.json(errorBody(result.error), ISSUE_GOODS_RECEIPT_ERROR_STATUS[result.error]);
    }
    return c.json(toGoodsReceiptDto(result.value), 200);
  });

  return routes;
}
