import {
  ApiError,
  ListPurchaseOrdersQuery,
  ListPurchaseOrdersResponse,
  PURCHASE_ORDER_ROLES,
  PurchaseOrder,
  PurchaseOrderIdParam,
  type PurchaseOrderSummary,
  type PurchaseOrderTotals,
  SavePurchaseOrderRequest,
} from "@cuadre/contracts";
import { type CalendarDate, quantityToString } from "@cuadre/shared-kernel";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import {
  errorBody,
  forbiddenResponse,
  openApiOptions,
  unauthorizedResponse,
} from "../../../http/api-error.ts";
import { createPurchaseOrderUseCase } from "../application/create-purchase-order.ts";
import { deletePurchaseOrderUseCase } from "../application/delete-purchase-order.ts";
import { getPurchaseOrderUseCase } from "../application/get-purchase-order.ts";
import { listPurchaseOrdersUseCase } from "../application/list-purchase-orders.ts";
import type {
  EnrichedPurchaseOrder,
  PurchaseOrderRepository,
  PurchasingLookups,
} from "../application/purchase-order-repository.ts";
import { updatePurchaseOrderUseCase } from "../application/update-purchase-order.ts";
import {
  CREATE_PURCHASE_ORDER_ERROR_STATUS,
  DELETE_PURCHASE_ORDER_ERROR_STATUS,
  GET_PURCHASE_ORDER_ERROR_STATUS,
  UPDATE_PURCHASE_ORDER_ERROR_STATUS,
} from "./error-status.ts";

function toTotalsDto(enriched: EnrichedPurchaseOrder): PurchaseOrderTotals {
  const { totals } = enriched;
  return {
    subtotal: { minorUnits: totals.subtotal.minorUnits, currency: totals.subtotal.currency },
    ivaByRate: {
      general: {
        minorUnits: totals.ivaByRate.general.minorUnits,
        currency: totals.ivaByRate.general.currency,
      },
      reduced: {
        minorUnits: totals.ivaByRate.reduced.minorUnits,
        currency: totals.ivaByRate.reduced.currency,
      },
      exempt: {
        minorUnits: totals.ivaByRate.exempt.minorUnits,
        currency: totals.ivaByRate.exempt.currency,
      },
    },
    ivaTotal: { minorUnits: totals.ivaTotal.minorUnits, currency: totals.ivaTotal.currency },
    total: { minorUnits: totals.total.minorUnits, currency: totals.total.currency },
  };
}

function toPurchaseOrderDto(enriched: EnrichedPurchaseOrder): PurchaseOrder {
  return {
    id: enriched.order.id,
    supplier: {
      id: enriched.supplier.id,
      rif: enriched.supplier.rif,
      name: enriched.supplier.name,
    },
    currency: enriched.order.currency,
    documentDate: enriched.order.documentDate,
    status: enriched.order.status,
    lines: enriched.order.lines.map((line, index) => {
      const product = enriched.productsById.get(line.productId);
      const lineTotal = enriched.totals.lineTotals[index];
      if (product === undefined || lineTotal === undefined) {
        throw new Error(`Missing product or line total for line ${line.id}`);
      }
      return {
        id: line.id,
        productId: line.productId,
        productSku: product.sku,
        productName: product.name,
        unitOfMeasure: product.unitOfMeasure,
        taxRate: product.taxRate,
        quantity: quantityToString(line.quantity),
        unitCost: { minorUnits: line.unitCost.minorUnits, currency: line.unitCost.currency },
        lineTotal: { minorUnits: lineTotal.minorUnits, currency: lineTotal.currency },
      };
    }),
    totals: toTotalsDto(enriched),
  };
}

function toPurchaseOrderSummaryDto(enriched: EnrichedPurchaseOrder): PurchaseOrderSummary {
  return {
    id: enriched.order.id,
    supplier: {
      id: enriched.supplier.id,
      rif: enriched.supplier.rif,
      name: enriched.supplier.name,
    },
    currency: enriched.order.currency,
    documentDate: enriched.order.documentDate,
    status: enriched.order.status,
    lineCount: enriched.order.lines.length,
    totals: toTotalsDto(enriched),
  };
}

const listPurchaseOrdersRoute = createRoute({
  method: "get",
  path: "/purchase-orders",
  tags: ["Purchasing"],
  middleware: [allowRoles(PURCHASE_ORDER_ROLES.read)] as const,
  request: { query: ListPurchaseOrdersQuery },
  responses: {
    200: {
      description: "A page of purchase orders.",
      content: { "application/json": { schema: ListPurchaseOrdersResponse } },
    },
    400: {
      description: "Invalid query parameters.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const getPurchaseOrderRoute = createRoute({
  method: "get",
  path: "/purchase-orders/{id}",
  tags: ["Purchasing"],
  middleware: [allowRoles(PURCHASE_ORDER_ROLES.read)] as const,
  request: { params: PurchaseOrderIdParam },
  responses: {
    200: {
      description: "Purchase order details.",
      content: { "application/json": { schema: PurchaseOrder } },
    },
    404: {
      description: "Purchase order not found.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const createPurchaseOrderRoute = createRoute({
  method: "post",
  path: "/purchase-orders",
  tags: ["Purchasing"],
  middleware: [allowRoles(PURCHASE_ORDER_ROLES.write)] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: SavePurchaseOrderRequest } },
    },
  },
  responses: {
    201: {
      description: "Draft purchase order created.",
      content: { "application/json": { schema: PurchaseOrder } },
    },
    400: {
      description: "Invalid purchase order fields.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const updatePurchaseOrderRoute = createRoute({
  method: "put",
  path: "/purchase-orders/{id}",
  tags: ["Purchasing"],
  middleware: [allowRoles(PURCHASE_ORDER_ROLES.write)] as const,
  request: {
    params: PurchaseOrderIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: SavePurchaseOrderRequest } },
    },
  },
  responses: {
    200: {
      description: "Draft purchase order updated.",
      content: { "application/json": { schema: PurchaseOrder } },
    },
    400: {
      description: "Invalid purchase order fields.",
      content: { "application/json": { schema: ApiError } },
    },
    404: {
      description: "Purchase order not found.",
      content: { "application/json": { schema: ApiError } },
    },
    409: {
      description: "Purchase order is no longer a draft.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

const deletePurchaseOrderRoute = createRoute({
  method: "delete",
  path: "/purchase-orders/{id}",
  tags: ["Purchasing"],
  middleware: [allowRoles(PURCHASE_ORDER_ROLES.write)] as const,
  request: { params: PurchaseOrderIdParam },
  responses: {
    204: { description: "Draft purchase order deleted." },
    404: {
      description: "Purchase order not found.",
      content: { "application/json": { schema: ApiError } },
    },
    409: {
      description: "Purchase order is no longer a draft.",
      content: { "application/json": { schema: ApiError } },
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

export function createPurchaseOrderRoutes(
  repository: PurchaseOrderRepository,
  lookups: PurchasingLookups,
  today: () => CalendarDate,
): OpenAPIHono {
  const routes = new OpenAPIHono(openApiOptions);

  routes.openapi(listPurchaseOrdersRoute, async (c) => {
    const query = c.req.valid("query");
    const result = await listPurchaseOrdersUseCase(repository, lookups, { page: query.page });
    return c.json(
      {
        items: result.items.map(toPurchaseOrderSummaryDto),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
      200,
    );
  });

  routes.openapi(getPurchaseOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await getPurchaseOrderUseCase(repository, lookups, id);
    if (!result.ok) {
      return c.json(errorBody(result.error), GET_PURCHASE_ORDER_ERROR_STATUS[result.error]);
    }
    return c.json(toPurchaseOrderDto(result.value), 200);
  });

  routes.openapi(createPurchaseOrderRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createPurchaseOrderUseCase(repository, lookups, body, today());
    if (!result.ok) {
      return c.json(
        errorBody(result.error, { issues: result.issues }),
        CREATE_PURCHASE_ORDER_ERROR_STATUS[result.error],
      );
    }
    return c.json(toPurchaseOrderDto(result.value), 201);
  });

  routes.openapi(updatePurchaseOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updatePurchaseOrderUseCase(repository, lookups, id, body, today());
    if (!result.ok) {
      if (result.error === "VALIDATION_ERROR") {
        return c.json(
          errorBody(result.error, { issues: result.issues }),
          UPDATE_PURCHASE_ORDER_ERROR_STATUS[result.error],
        );
      }
      return c.json(errorBody(result.error), UPDATE_PURCHASE_ORDER_ERROR_STATUS[result.error]);
    }
    return c.json(toPurchaseOrderDto(result.value), 200);
  });

  routes.openapi(deletePurchaseOrderRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await deletePurchaseOrderUseCase(repository, id);
    if (!result.ok) {
      return c.json(errorBody(result.error), DELETE_PURCHASE_ORDER_ERROR_STATUS[result.error]);
    }
    return c.body(null, 204);
  });

  return routes;
}
