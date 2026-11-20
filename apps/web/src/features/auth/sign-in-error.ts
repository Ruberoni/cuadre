/**
 * Why signing in failed, in the Login handoff's terms (#10). Better Auth answers with its own codes;
 * this is the one place that maps them.
 */
export type SignInError =
  /** Wrong password or unknown email: never told apart. */
  | "INVALID_CREDENTIALS"
  /** Better Auth's rate limit (HTTP 429). */
  | "TOO_MANY_ATTEMPTS"
  /** The server's own email shape check; shown on Correo electrónico. */
  | "INVALID_EMAIL"
  /** No answer, a 5xx or anything unexpected. */
  | "NETWORK_ERROR";

export function toSignInError(status: number, code: string | undefined): SignInError {
  if (status === 429) return "TOO_MANY_ATTEMPTS";
  if (status === 401 && code === "INVALID_EMAIL_OR_PASSWORD") return "INVALID_CREDENTIALS";
  if (status === 400 && code === "INVALID_EMAIL") return "INVALID_EMAIL";
  return "NETWORK_ERROR";
}
