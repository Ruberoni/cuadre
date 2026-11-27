import {
  ApiError,
  CreateCustomerRequest,
  CUSTOMER_ROLES,
  Customer as CustomerDto,
  ListCustomersQuery,
  ListCustomersResponse,
} from "@cuadre/contracts";
import { createRoute, type OpenAPIHono, type z } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import { errorBody, forbiddenResponse, unauthorizedResponse } from "../../../http/api-error.ts";
import { createCustomerUseCase } from "../application/create-customer.ts";
import { listCustomersUseCase } from "../application/list-customers.ts";
import type { PartnerRepository } from "../application/partner-repository.ts";
import { CREATE_CUSTOMER_ERROR_STATUS } from "./error-status.ts";
import { toPartnerDto } from "./partner-dto.ts";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

const createCustomerRoute = createRoute({
  method: "post",
  path: "/customers",
  middleware: [allowRoles(CUSTOMER_ROLES.write)] as const,
  request: { body: { content: json(CreateCustomerRequest), required: true } },
  responses: {
    200: {
      description: "The existing partner also became a customer.",
      content: json(CustomerDto),
    },
    201: { description: "The customer was created.", content: json(CustomerDto) },
    400: { description: "Invalid input; `issues` names the fields.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    409: {
      description:
        "The RIF is already used by another customer (`RIF_ALREADY_EXISTS`) or belongs to an existing supplier requiring confirmation (`PARTNER_ALREADY_EXISTS`).",
      content: json(ApiError),
    },
  },
});

const listCustomersRoute = createRoute({
  method: "get",
  path: "/customers",
  middleware: [allowRoles(CUSTOMER_ROLES.read)] as const,
  request: { query: ListCustomersQuery },
  responses: {
    200: { description: "One page of customers.", content: json(ListCustomersResponse) },
    400: { description: "Invalid query.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

export function registerCustomerRoutes(routes: OpenAPIHono, partners: PartnerRepository): void {
  routes.openapi(createCustomerRoute, async (c) => {
    const result = await createCustomerUseCase(partners, c.req.valid("json"));
    if (result.ok) {
      return c.json(toPartnerDto(result.value), result.promoted ? 200 : 201);
    }

    const status = CREATE_CUSTOMER_ERROR_STATUS[result.error];
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

  routes.openapi(listCustomersRoute, async (c) => {
    const page = await listCustomersUseCase(partners, c.req.valid("query"));
    return c.json({ ...page, items: page.items.map(toPartnerDto) }, 200);
  });
}
