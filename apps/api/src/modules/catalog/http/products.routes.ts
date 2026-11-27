import {
  ApiError,
  CreateProductRequest,
  ListProductsQuery,
  ListProductsResponse,
  PRODUCT_ROLES,
  Product as ProductDto,
} from "@cuadre/contracts";
import { createRoute, OpenAPIHono, type z } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import {
  errorBody,
  forbiddenResponse,
  openApiOptions,
  unauthorizedResponse,
} from "../../../http/api-error.ts";
import { createProductUseCase } from "../application/create-product.ts";
import { listProductsUseCase } from "../application/list-products.ts";
import type { ProductRepository } from "../application/product-repository.ts";
import type { Product } from "../domain/product.ts";
import { CREATE_PRODUCT_ERROR_STATUS } from "./error-status.ts";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

export const createProductRoute = createRoute({
  method: "post",
  path: "/products",
  middleware: [allowRoles(PRODUCT_ROLES.write)] as const,
  request: { body: { content: json(CreateProductRequest), required: true } },
  responses: {
    201: { description: "The product was created.", content: json(ProductDto) },
    400: { description: "Invalid input; `issues` names the fields.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    409: { description: "The code is already used by another product.", content: json(ApiError) },
  },
});

export const listProductsRoute = createRoute({
  method: "get",
  path: "/products",
  middleware: [allowRoles(PRODUCT_ROLES.read)] as const,
  request: { query: ListProductsQuery },
  responses: {
    200: { description: "One page of products.", content: json(ListProductsResponse) },
    400: { description: "Invalid query.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

function toDto(product: Product, onHand = "0"): ProductDto {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    unitOfMeasure: product.unitOfMeasure,
    salePrice: { minorUnits: product.salePrice.minorUnits, currency: "USD" },
    taxRate: product.taxRate,
    onHand,
  };
}

export function createProductRoutes(
  products: ProductRepository,
  getOnHandByProductIds?: (productIds: readonly string[]) => Promise<ReadonlyMap<string, string>>,
) {
  const routes = new OpenAPIHono(openApiOptions);

  routes.openapi(createProductRoute, async (c) => {
    const result = await createProductUseCase(products, c.req.valid("json"));
    if (result.ok) return c.json(toDto(result.value, "0"), 201);

    const status = CREATE_PRODUCT_ERROR_STATUS[result.error];
    if (result.error === "VALIDATION_ERROR") {
      return c.json(errorBody("VALIDATION_ERROR", { issues: result.issues }), status);
    }
    return c.json(errorBody(result.error, { sku: result.sku }), status);
  });

  routes.openapi(listProductsRoute, async (c) => {
    const page = await listProductsUseCase(products, c.req.valid("query"));
    const onHandById =
      page.items.length > 0 && getOnHandByProductIds !== undefined
        ? await getOnHandByProductIds(page.items.map((item) => item.id))
        : new Map<string, string>();
    return c.json(
      { ...page, items: page.items.map((item) => toDto(item, onHandById.get(item.id) ?? "0")) },
      200,
    );
  });

  return routes;
}
