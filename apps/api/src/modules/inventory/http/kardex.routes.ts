import {
  ApiError,
  GetKardexQuery,
  KARDEX_ROLES,
  KardexProductParam,
  KardexResponse,
} from "@cuadre/contracts";
import { createRoute, OpenAPIHono, type z } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import {
  errorBody,
  forbiddenResponse,
  openApiOptions,
  unauthorizedResponse,
} from "../../../http/api-error.ts";
import { getKardexUseCase, type KardexPage } from "../application/get-kardex.ts";
import type { InventoryRepository, KardexLookups } from "../application/inventory-repository.ts";
import { GET_KARDEX_ERROR_STATUS } from "./error-status.ts";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

export const getKardexRoute = createRoute({
  method: "get",
  path: "/kardex/{productId}",
  middleware: [allowRoles(KARDEX_ROLES.read)] as const,
  request: { params: KardexProductParam, query: GetKardexQuery },
  responses: {
    200: {
      description: "Chronological stock ledger for one product.",
      content: json(KardexResponse),
    },
    400: { description: "Invalid product id or query.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    404: { description: "Product not found.", content: json(ApiError) },
  },
});

function toDto(page: KardexPage): KardexResponse {
  return {
    product: {
      id: page.product.id,
      sku: page.product.sku,
      name: page.product.name,
      unitOfMeasure: page.product.unitOfMeasure,
    },
    onHand: page.onHand,
    averageCost:
      page.averageCost === null
        ? null
        : { minorUnits: page.averageCost.minorUnits, currency: "USD" },
    items: page.items.map((entry) => ({
      id: entry.id,
      documentDate: entry.documentDate,
      direction: entry.direction,
      quantity: entry.quantity,
      unitCost: { minorUnits: entry.unitCost.minorUnits, currency: "USD" },
      averageCostAfter:
        entry.averageCostAfter === null
          ? null
          : { minorUnits: entry.averageCostAfter.minorUnits, currency: "USD" },
      onHandAfter: entry.onHandAfter,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      referenceNumber: entry.referenceNumber,
    })),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  };
}

export function createKardexRoutes(
  repository: Pick<InventoryRepository, "listMovementsByProduct">,
  lookups: KardexLookups,
) {
  const routes = new OpenAPIHono(openApiOptions);

  routes.openapi(getKardexRoute, async (c) => {
    const { productId } = c.req.valid("param");
    const { page } = c.req.valid("query");
    const result = await getKardexUseCase(repository, lookups, { productId, page });
    if (result.ok) return c.json(toDto(result.value), 200);
    return c.json(errorBody(result.error), GET_KARDEX_ERROR_STATUS[result.error]);
  });

  return routes;
}
