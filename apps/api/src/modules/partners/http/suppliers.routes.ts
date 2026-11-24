import {
  ApiError,
  CreateSupplierRequest,
  ListSuppliersQuery,
  ListSuppliersResponse,
  SUPPLIER_ROLES,
  Supplier as SupplierDto,
} from "@cuadre/contracts";
import { createRoute, type OpenAPIHono, type z } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import { errorBody, forbiddenResponse, unauthorizedResponse } from "../../../http/api-error.ts";
import { createSupplierUseCase } from "../application/create-supplier.ts";
import { listSuppliersUseCase } from "../application/list-suppliers.ts";
import type { PartnerRepository } from "../application/partner-repository.ts";
import { CREATE_SUPPLIER_ERROR_STATUS } from "./error-status.ts";
import { toPartnerDto } from "./partner-dto.ts";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

export const createSupplierRoute = createRoute({
  method: "post",
  path: "/suppliers",
  middleware: [allowRoles(SUPPLIER_ROLES.write)] as const,
  request: { body: { content: json(CreateSupplierRequest), required: true } },
  responses: {
    200: {
      description: "The existing partner also became a supplier.",
      content: json(SupplierDto),
    },
    201: { description: "The supplier was created.", content: json(SupplierDto) },
    400: { description: "Invalid input; `issues` names the fields.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    409: {
      description:
        "The RIF is already used by another supplier (`RIF_ALREADY_EXISTS`) or belongs to an existing customer requiring confirmation (`PARTNER_ALREADY_EXISTS`).",
      content: json(ApiError),
    },
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

export function registerSupplierRoutes(routes: OpenAPIHono, partners: PartnerRepository): void {
  routes.openapi(createSupplierRoute, async (c) => {
    const result = await createSupplierUseCase(partners, c.req.valid("json"));
    if (result.ok) {
      return c.json(toPartnerDto(result.value), result.promoted ? 200 : 201);
    }

    const status = CREATE_SUPPLIER_ERROR_STATUS[result.error];
    if (result.error === "VALIDATION_ERROR") {
      return c.json(errorBody("VALIDATION_ERROR", { issues: result.issues }), status);
    }
    if (result.error === "PARTNER_ALREADY_EXISTS") {
      return c.json(
        errorBody("PARTNER_ALREADY_EXISTS", {
          rif: result.rif,
          partnerName: result.partnerName,
        }),
        status,
      );
    }
    return c.json(errorBody(result.error, { rif: result.rif }), status);
  });

  routes.openapi(listSuppliersRoute, async (c) => {
    const page = await listSuppliersUseCase(partners, c.req.valid("query"));
    return c.json({ ...page, items: page.items.map(toPartnerDto) }, 200);
  });
}
