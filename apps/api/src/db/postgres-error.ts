export const UNIQUE_VIOLATION = "23505";

/** Drizzle wraps driver errors; the Postgres code and constraint sit on the error or its cause. */
export function postgresError(error: unknown): { code?: string; constraint?: string } {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const { code, constraint_name: constraint } = current as {
      code?: unknown;
      constraint_name?: unknown;
    };
    if (typeof code === "string") {
      return { code, ...(typeof constraint === "string" ? { constraint } : {}) };
    }
    current = (current as { cause?: unknown }).cause;
  }
  return {};
}
