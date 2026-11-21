import type { Role } from "@cuadre/contracts";
import type { Hono, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { matchedRoutes } from "hono/route";
import { METHOD_NAME_ALL } from "hono/router";
import { findTargetHandler, isMiddleware } from "hono/utils/handler";
import { errorBody } from "../http/api-error.ts";
import type { SessionVariables } from "./require-session.ts";

// The role matrix at the API (PLAN → Roles). Every endpoint under /api declares its roles with
// `allowRoles(...)` in its `createRoute({ middleware })`; `requireRoleDeclaration()` refuses any
// endpoint that does not (deny by default), and `routesWithoutRoles(app)` lets a test list them.

/** The roles each `allowRoles` middleware lets through, so the gate and the inventory can find it. */
const policies = new WeakMap<object, readonly Role[]>();

const forbidden = () => errorBody("FORBIDDEN");

/**
 * Lets only these roles call the route; any other signed-in user gets 403 `FORBIDDEN`. Put it in
 * the route's `middleware`, which `@hono/zod-openapi` runs before the request validators, so a
 * refused role never learns whether its input was valid. An empty list throws when the route is
 * defined (at boot), never at request time: it would refuse everyone.
 */
export function allowRoles(roles: readonly Role[]): MiddlewareHandler<{
  Variables: SessionVariables;
}> {
  if (roles.length === 0) throw new Error("allowRoles needs at least one role.");
  const allowed: readonly Role[] = [...roles];
  const middleware = createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    // Outside the session gate there is no user: refuse instead of failing with a 500.
    const user = c.get("user") as SessionVariables["user"] | undefined;
    if (user === undefined || !allowed.includes(user.role)) return c.json(forbidden(), 403);
    await next();
  });
  policies.set(middleware, allowed);
  return middleware;
}

type HandlerFunction = Parameters<typeof findTargetHandler>[0];

/** The handler itself, through the wrapper `app.route()` adds when a sub-app has its own onError. */
const target = (handler: unknown) => findTargetHandler(handler as HandlerFunction);

/** The roles a registered handler declares, if it is an `allowRoles` middleware. */
const policyOf = (handler: unknown): readonly Role[] | undefined => policies.get(target(handler));

type RegisteredRoute = { method: string; path: string; handler: unknown };

const isApiPath = (path: string) =>
  (path === "/api" || path.startsWith("/api/")) &&
  path !== "/api/auth" &&
  !path.startsWith("/api/auth/");

/**
 * A handler that answers a request (not an `allowRoles` policy): one registered with a method, or
 * with `ALL` and no `next` parameter (`app.all`, a terminal `use`). Hono tells middleware apart only
 * by that parameter, so an `ALL` handler that takes `next` counts as middleware even if it answers.
 */
function isEndpoint(route: RegisteredRoute): boolean {
  if (policyOf(route.handler) !== undefined) return false;
  if (route.method !== METHOD_NAME_ALL) return true;
  return !isMiddleware(target(route.handler));
}

/**
 * Deny by default: an endpoint that declares no roles answers 403 `FORBIDDEN` to everyone. Mounted
 * on `/api/*` after the session gate, so it sees every request under /api but Better Auth's, whatever
 * path the endpoint was registered with (a catch-all `*` too). No endpoint matched → on to the 404.
 */
export function requireRoleDeclaration(): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const routes: readonly RegisteredRoute[] = matchedRoutes(c);
    // The first endpoint matched is the one that answers: a policy on its own method and path must
    // run before it, or the handler would answer without the check.
    const index = routes.findIndex(isEndpoint);
    const endpoint = routes[index];
    if (endpoint === undefined) return next();
    const declared = routes
      .slice(0, index)
      .some(
        (route) =>
          route.method === endpoint.method &&
          route.path === endpoint.path &&
          policyOf(route.handler) !== undefined,
      );
    if (!declared) return c.json(forbidden(), 403);
    await next();
  });
}

/**
 * Every endpoint registered under /api (Better Auth's aside) that declares no roles before its first
 * handler, as `"METHOD /path"`, in registration order.
 */
export function routesWithoutRoles(app: Pick<Hono, "routes">): string[] {
  const declared = new Set<string>();
  const undeclared = new Set<string>();
  for (const route of app.routes) {
    if (!isApiPath(route.path)) continue;
    const key = `${route.method} ${route.path}`;
    if (declared.has(key) || undeclared.has(key)) continue;
    if (policyOf(route.handler) !== undefined) declared.add(key);
    else if (isEndpoint(route)) undeclared.add(key);
  }
  return [...undeclared];
}
