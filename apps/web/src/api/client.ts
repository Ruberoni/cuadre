import { ApiError, type ApiErrorCode, type FieldIssue } from "@cuadre/contracts";
import type { z } from "zod";

/** Codes the API answers with, plus the one the browser raises itself when no answer arrives. */
export type ClientErrorCode = ApiErrorCode | "NETWORK_ERROR";

/** A failed call: the API's `ApiError`, or `NETWORK_ERROR` when no answer arrived at all. */
export type ApiFailure = {
  code: ClientErrorCode;
  issues?: readonly FieldIssue[];
  sku?: string;
};

/** Thrown by query functions, which TanStack Query needs as an exception. */
export class ApiFailureError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(failure.code);
    this.failure = failure;
  }
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiFailure };

const ok = <T>(value: T): ApiResult<T> => ({ ok: true, value });
const fail = (error: ApiFailure): ApiResult<never> => ({ ok: false, error });

const INTERNAL: ApiFailure = { code: "INTERNAL_ERROR" satisfies ApiErrorCode };

let onUnauthorized: () => void = () => {};

/** What to do when an API call answers 401 (the session ended): set once by the app, to go to Login. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/**
 * Calls the API on the page's own origin (`/api/...`, proxied in dev and preview). The success body
 * is parsed with the contract's schema, so a drifting API fails here, not three components later.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  success: S,
  init?: { method: "POST"; body: unknown },
): Promise<ApiResult<z.infer<S>>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: init?.method ?? "GET",
      ...(init === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(init.body) }),
    });
  } catch {
    return fail({ code: "NETWORK_ERROR" });
  }

  if (response.status === 401) {
    onUnauthorized();
    return fail({ code: "UNAUTHORIZED" });
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const parsed = success.safeParse(body);
    return parsed.success ? ok(parsed.data) : fail(INTERNAL);
  }
  const failure = ApiError.safeParse(body);
  if (!failure.success) return fail(INTERNAL);
  const { code, issues, sku } = failure.data;
  return fail({
    code,
    ...(issues === undefined ? {} : { issues }),
    ...(sku === undefined ? {} : { sku }),
  });
}

export function unwrapOrThrow<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new ApiFailureError(result.error);
  return result.value;
}
