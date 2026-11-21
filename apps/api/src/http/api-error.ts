// The one place that turns failures into HTTP answers (ADR-009): every non-2xx body is an
// `ApiError` from `@cuadre/contracts`, except Better Auth's own routes (`/api/auth/*`,
// src/auth). Modules map their own error codes to statuses with an
// exhaustive `Record`, and use `errorBody` to build the body.
import { ApiError, type ApiErrorCode, type FieldIssue } from "@cuadre/contracts";
import type { Hook, OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Env } from "hono";
import { HTTPException } from "hono/http-exception";

export function errorBody(
  code: ApiErrorCode,
  extra: { issues?: readonly FieldIssue[]; sku?: string } = {},
): ApiError {
  return {
    code,
    ...(extra.issues === undefined ? {} : { issues: [...extra.issues] }),
    ...(extra.sku === undefined ? {} : { sku: extra.sku }),
  };
}

/**
 * Request schemas only check the wire shape. A field that is absent is `REQUIRED`; anything else
 * the shape rejects (wrong type, unknown enum value, a price in another currency) is `INVALID`.
 * The business rules (format, length, price > 0) are the domain's and come back as the same issues.
 */
export const validationHook: Hook<
  unknown,
  Env,
  string,
  Promise<Response | undefined> | Response | undefined
> = async (result, c) => {
  if (result.success) return undefined;
  // One issue per field, even when several rules of the shape fail on it (e.g. a price object).
  const fields = new Set<string>();
  for (const issue of result.error.issues) {
    if (issue.path[0] !== undefined) fields.add(String(issue.path[0]));
  }
  // A body that is not even an object has no field to blame: the client shows the generic message.
  if (fields.size === 0) return c.json(errorBody("VALIDATION_ERROR"), 400);

  const sent = await sentValues(result.target, c);
  const issues: FieldIssue[] = [...fields].map((field) => ({
    field,
    code: sent[field] === undefined ? "REQUIRED" : "INVALID",
  }));
  return c.json(errorBody("VALIDATION_ERROR", { issues }), 400);
};

/** What the client sent, by field, to tell a missing field from an invalid one. */
async function sentValues(target: string, c: Context): Promise<Record<string, unknown>> {
  if (target === "query") return c.req.query();
  if (target !== "json") return {};
  const body: unknown = await c.req.json().catch(() => undefined);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/**
 * The 401 every route behind the session gate can answer (`src/auth/require-session.ts`): spread
 * into each `createRoute`'s `responses` so the OpenAPI document shows it.
 */
export const unauthorizedResponse = {
  401: {
    description: "No valid session.",
    content: { "application/json": { schema: ApiError } },
  },
} as const;

/**
 * The 403 of a route whose roles do not include the user's (`allowRoles`, `src/auth/roles.ts`):
 * spread into the `responses` of every route that declares roles.
 */
export const forbiddenResponse = {
  403: {
    description: "The user's role may not call this route.",
    content: { "application/json": { schema: ApiError } },
  },
} as const;

/** Every `OpenAPIHono` needs the hook itself: sub-apps do not inherit it. */
export const openApiOptions = { defaultHook: validationHook };

export function handleError(error: Error, c: Context): Response {
  // Malformed JSON bodies surface as a 400 HTTPException from the validator.
  if (error instanceof HTTPException && error.status === 400) {
    return c.json(errorBody("VALIDATION_ERROR"), 400);
  }
  console.error(error);
  return c.json(errorBody("INTERNAL_ERROR"), 500);
}

export function handleNotFound(c: Context): Response {
  return c.json(errorBody("NOT_FOUND"), 404);
}

/** Wires the shared error answers into an app. */
export function useErrorHandlers(app: OpenAPIHono): void {
  app.onError(handleError);
  app.notFound(handleNotFound);
}
