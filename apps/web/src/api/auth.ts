// Better Auth's routes (`/api/auth/*`) answer with their own bodies, not `ApiError`s, so they do not
// go through `apiRequest` (whose 401 handler would also loop here). `SessionUser` from contracts is
// their contract: Better Auth is not in the OpenAPI document.
import { SessionUser } from "@cuadre/contracts";
import { z } from "zod";
import { type SignInError, toSignInError } from "@/features/auth/sign-in-error";

const GetSessionResponse = z.object({ user: SessionUser }).nullable();
const SignInResponse = z.object({ user: SessionUser });
const BetterAuthError = z.object({ code: z.string().optional() });

const postJson = (path: string, body: unknown) =>
  fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** The signed-in user, or `null`. Throws when the API cannot answer (the shell then goes to Login). */
export async function getSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/get-session");
  if (!response.ok) throw new Error(`get-session answered ${response.status}`);
  return GetSessionResponse.parse(await response.json())?.user ?? null;
}

export type SignInResult = { ok: true; value: SessionUser } | { ok: false; error: SignInError };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  let response: Response;
  try {
    response = await postJson("/sign-in/email", { email, password });
  } catch {
    return { ok: false, error: "NETWORK_ERROR" };
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const parsed = SignInResponse.safeParse(body);
    return parsed.success
      ? { ok: true, value: parsed.data.user }
      : { ok: false, error: "NETWORK_ERROR" };
  }
  const error = BetterAuthError.safeParse(body);
  return { ok: false, error: toSignInError(response.status, error.data?.code) };
}

/**
 * Ends the session on the server. `false` when it may still be open (no answer, or an error other
 * than "no session"): the app must not pretend the user signed out, or Login would let them back in.
 */
export async function signOut(): Promise<boolean> {
  try {
    const response = await postJson("/sign-out", {});
    return response.ok || response.status === 401;
  } catch {
    return false;
  }
}
