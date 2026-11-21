import { type SessionUser, SessionUser as SessionUserSchema } from "@cuadre/contracts";
import { createMiddleware } from "hono/factory";
import { errorBody } from "../http/api-error.ts";
import type { Auth } from "./auth.ts";

/** What `requireSession` leaves in the context for the routes after it (`c.get("user")`). */
export type SessionVariables = { user: SessionUser };

/**
 * Every API route behind it needs a valid session: none, expired, signed out or a forged cookie
 * all answer 401 `UNAUTHORIZED` (an `ApiError`). Role checks build on it (`roles.ts`).
 */
export function requireSession(auth: Auth) {
  return createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
    // Read-only (`disableRefresh`): a renewal here would move `expiresAt` without sending the new
    // cookie, and the web's `get-session` would then see nothing to renew. Only `get-session`
    // (every shell mount and window focus) renews, so the cookie always follows the session.
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
      query: { disableRefresh: true },
    });
    const user = SessionUserSchema.safeParse(session?.user);
    if (!user.success) return c.json(errorBody("UNAUTHORIZED"), 401);
    c.set("user", user.data);
    await next();
  });
}
