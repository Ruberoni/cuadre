import {
  ApiError,
  CreateSupplierRequest,
  ListSuppliersQuery,
  ListSuppliersResponse,
  SUPPLIER_ROLES,
  Supplier as SupplierDto,
} from "@cuadre/contracts";
import { createRoute, OpenAPIHono, type z } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import {
  errorBody,
  forbiddenResponse,
  openApiOptions,
  unauthorizedResponse,
} from "../../../http/api-error.ts";
import { createSupplierUseCase } from "../application/create-supplier.ts";
import { listSuppliersUseCase } from "../application/list-suppliers.ts";
import type { PartnerRepository } from "../application/partner-repository.ts";
import type { Partner } from "../domain/partner.ts";
import { CREATE_SUPPLIER_ERROR_STATUS } from "./error-status.ts";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

export const createSupplierRoute = createRoute({
  method: "post",
  path: "/suppliers",
  middleware: [allowRoles(SUPPLIER_ROLES.write)] as const,
  request: { body: { content: json(CreateSupplierRequest), required: true } },
  responses: {
    201: { description: "The supplier was created.", content: json(SupplierDto) },
    400: { description: "Invalid input; `issues` names the fields.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    409: { description: "The RIF is already used by another partner.", content: json(ApiError) },
  },
});

export const listSuppliersRoute = createRoute({
  method: "get",
  path: "/suppliers",
  middleware: [allowRoles(SUPPLIER_ROLES.read)] as const,
  request: { query: ListSuppliersQuery },
  responses: {
    200: { description: "One page of suppliers.", content: json(ListSuppliersResponse) },
    400: { description: "Invalid query.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

function toDto(partner: Partner): SupplierDto {
  return {
    id: partner.id,
    rif: partner.rif,
    name: partner.name,
    phone: partner.phone,
    email: partner.email,
    address: partner.address,
  };
}

export function createSupplierRoutes(partners: PartnerRepository) {
  const routes = new OpenAPIHono(openApiOptions);

  routes.openapi(createSupplierRoute, async (c) => {
    const result = await createSupplierUseCase(partners, c.req.valid("json"));
    if (result.ok) return c.json(toDto(result.value), 201);

    const status = CREATE_SUPPLIER_ERROR_STATUS[result.error];
    if (result.error === "VALIDATION_ERROR") {
      return c.json(errorBody("VALIDATION_ERROR", { issues: result.issues }), status);
    }
    return c.json(errorBody(result.error, { rif: result.rif }), status);
  });

  routes.openapi(listSuppliersRoute, async (c) => {
    const page = await listSuppliersUseCase(partners, c.req.valid("query"));
    return c.json({ ...page, items: page.items.map(toDto) }, 200);
  });

  return routes;
}
