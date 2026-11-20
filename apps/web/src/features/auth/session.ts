import type { SessionUser } from "@cuadre/contracts";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
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

/** Sets what the app knows about the session, first cancelling a check in flight that would undo it. */
export async function setSession(queryClient: QueryClient, state: SessionState): Promise<void> {
  await queryClient.cancelQueries({ queryKey: sessionQueryKey });
  queryClient.setQueryData<SessionState>(sessionQueryKey, state);
}

/**
 * The session ended (signed out, expired or revoked): record why, which sends the shell to Login,
 * and drop every other cached app data, so neither Back nor the next user can see it. Not
 * `clear()`: the session query must keep its observers.
 */
export async function endSession(
  queryClient: QueryClient,
  { signedOut }: { signedOut: boolean },
): Promise<void> {
  await setSession(queryClient, { user: null, signedOut });
  dropAppData(queryClient);
}

/** Removes every cached query but the session's. */
export function dropAppData(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] });
}
