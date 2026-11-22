import {
  ApiError,
  CorrectExchangeRateRequest,
  CurrentExchangeRateResponse,
  EXCHANGE_RATE_ROLES,
  ExchangeRateDateParam,
  ExchangeRate as ExchangeRateDto,
  ListExchangeRatesQuery,
  ListExchangeRatesResponse,
  RecordExchangeRateRequest,
} from "@cuadre/contracts";
import { rateToString } from "@cuadre/shared-kernel";
import { createRoute, OpenAPIHono, type z } from "@hono/zod-openapi";
import { allowRoles } from "../../../auth/roles.ts";
import {
  errorBody,
  forbiddenResponse,
  openApiOptions,
  unauthorizedResponse,
} from "../../../http/api-error.ts";
import { correctExchangeRateUseCase } from "../application/correct-exchange-rate.ts";
import type { ExchangeRateRepository } from "../application/exchange-rate-repository.ts";
import { listExchangeRatesUseCase } from "../application/list-exchange-rates.ts";
import { lookupExchangeRateUseCase } from "../application/lookup-exchange-rate.ts";
import { recordExchangeRateUseCase } from "../application/record-exchange-rate.ts";
import type { CalendarDate } from "../domain/calendar-date.ts";
import type { ExchangeRateRecord } from "../domain/exchange-rate.ts";
import {
  CORRECT_EXCHANGE_RATE_ERROR_STATUS,
  RECORD_EXCHANGE_RATE_ERROR_STATUS,
} from "./error-status.ts";

const json = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });

export const listExchangeRatesRoute = createRoute({
  method: "get",
  path: "/exchange-rates",
  middleware: [allowRoles(EXCHANGE_RATE_ROLES.read)] as const,
  request: { query: ListExchangeRatesQuery },
  responses: {
    200: {
      description: "One page of BCV exchange rates.",
      content: json(ListExchangeRatesResponse),
    },
    400: { description: "Invalid query.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

export const currentExchangeRateRoute = createRoute({
  method: "get",
  path: "/exchange-rates/current",
  middleware: [allowRoles(EXCHANGE_RATE_ROLES.read)] as const,
  responses: {
    200: {
      description: "The active BCV exchange rate on or before today, or null when none exists.",
      content: json(CurrentExchangeRateResponse),
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
  },
});

export const recordExchangeRateRoute = createRoute({
  method: "post",
  path: "/exchange-rates",
  middleware: [allowRoles(EXCHANGE_RATE_ROLES.write)] as const,
  request: { body: { content: json(RecordExchangeRateRequest), required: true } },
  responses: {
    201: { description: "The exchange rate was recorded.", content: json(ExchangeRateDto) },
    400: {
      description:
        "Invalid input (`VALIDATION_ERROR`) or date beyond 7 days ahead (`RATE_DATE_TOO_FAR`).",
      content: json(ApiError),
    },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    409: { description: "A rate is already recorded for this date.", content: json(ApiError) },
  },
});

export const correctExchangeRateRoute = createRoute({
  method: "patch",
  path: "/exchange-rates/{date}",
  middleware: [allowRoles(EXCHANGE_RATE_ROLES.write)] as const,
  request: {
    params: ExchangeRateDateParam,
    body: { content: json(CorrectExchangeRateRequest), required: true },
  },
  responses: {
    200: { description: "The exchange rate was corrected.", content: json(ExchangeRateDto) },
    400: { description: "Invalid input; `issues` names the fields.", content: json(ApiError) },
    ...unauthorizedResponse,
    ...forbiddenResponse,
    404: { description: "No exchange rate exists for this date.", content: json(ApiError) },
    409: {
      description: "The exchange rate was already frozen by an issued document.",
      content: json(ApiError),
    },
  },
});

function toDto(record: ExchangeRateRecord): ExchangeRateDto {
  return {
    date: record.date,
    rate: rateToString(record.rate),
    frozen: record.frozen,
  };
}

export function createExchangeRateRoutes(rates: ExchangeRateRepository, today: () => CalendarDate) {
  const routes = new OpenAPIHono(openApiOptions);

  routes.openapi(listExchangeRatesRoute, async (c) => {
    const page = await listExchangeRatesUseCase(rates, c.req.valid("query"));
    return c.json({ ...page, items: page.items.map(toDto) }, 200);
  });

  routes.openapi(currentExchangeRateRoute, async (c) => {
    const result = await lookupExchangeRateUseCase(rates, today());
    return c.json({ rate: result.ok ? toDto(result.value) : null }, 200);
  });

  routes.openapi(recordExchangeRateRoute, async (c) => {
    const result = await recordExchangeRateUseCase(rates, c.req.valid("json"), today());
    if (result.ok) return c.json(toDto(result.value), 201);

    const status = RECORD_EXCHANGE_RATE_ERROR_STATUS[result.error];
    if (result.error === "VALIDATION_ERROR") {
      return c.json(errorBody("VALIDATION_ERROR", { issues: result.issues }), status);
    }
    return c.json(errorBody(result.error, { date: result.date }), status);
  });

  routes.openapi(correctExchangeRateRoute, async (c) => {
    const { date } = c.req.valid("param");
    const { rate } = c.req.valid("json");
    const result = await correctExchangeRateUseCase(rates, { date, rate });
    if (result.ok) return c.json(toDto(result.value), 200);

    const status = CORRECT_EXCHANGE_RATE_ERROR_STATUS[result.error];
    if (result.error === "VALIDATION_ERROR") {
      return c.json(errorBody("VALIDATION_ERROR", { issues: result.issues }), status);
    }
    return c.json(errorBody(result.error, { date: result.date }), status);
  });

  return routes;
}
