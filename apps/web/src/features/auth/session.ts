import type { SessionUser } from "@cuadre/contracts";
import { queryOptions } from "@tanstack/react-query";
import { getSession } from "@/api/auth";

/**
 * What the app knows about the session. `signedOut` marks a user who pressed Cerrar sesión: Login
 * then opens without a `redirect` back to where they were.
 */
export type SessionState = { user: SessionUser | null; signedOut: boolean };

export const sessionQueryKey = ["session"] as const;

/** Checked again on every mount of the shell and on window focus, so an ended session is noticed. */
export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async (): Promise<SessionState> => {
    const user = await getSession();
    return { user, signedOut: false };
  },
});
