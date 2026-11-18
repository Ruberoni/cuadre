import { type SessionUser, SessionUser as SessionUserSchema } from "@cuadre/contracts";
import { createMiddleware } from "hono/factory";
import { errorBody } from "../http/api-error.ts";
import type { Auth } from "./auth.ts";

/** What `requireSession` leaves in the context for the routes after it (`c.get("user")`). */
export type SessionVariables = { user: SessionUser };

/**
 * Every API route behind it needs a valid session: none, expired, signed out or a forged cookie
 * all answer 401 `UNAUTHORIZED` (an `ApiError`). Role checks are the next ticket's.
 */
export function requireSession(auth: Auth) {
  return createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const user = SessionUserSchema.safeParse(session?.user);
    if (!user.success) return c.json(errorBody("UNAUTHORIZED"), 401);
    c.set("user", user.data);
    await next();
  });
}
