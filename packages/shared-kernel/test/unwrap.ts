import type { Result } from "../src/result.ts";

/** Test-only helper: a failed Result in a test is a test bug, so it throws. */
export function unwrap<T, E extends string>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`Expected ok, got error ${result.error}`);
  return result.value;
}
