/** Where a signed-in user lands when there is nowhere (safe) to return to. */
export const HOME_PATH = "/productos";
const LOGIN_PATH = "/login";

/**
 * The `redirect` search param of Login, made safe: only a path on this same origin (never another
 * site, never Login itself) is kept; anything else lands on Productos. The URL parser does the
 * resolving, so tricks such as `//host`, `/\host` or control characters cannot slip past.
 */
export function safeRedirect(value: string | undefined, origin: string): string {
  if (value === undefined || !value.startsWith("/")) return HOME_PATH;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return HOME_PATH;
  }
  if (url.origin !== origin) return HOME_PATH;
  if (url.pathname === LOGIN_PATH || url.pathname.startsWith(`${LOGIN_PATH}/`)) return HOME_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}
