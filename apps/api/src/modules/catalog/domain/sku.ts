import { SKU_PATTERN } from "@cuadre/contracts";
import { type Brand, err, ok, type Result } from "@cuadre/shared-kernel";

/** Código: letters, digits and hyphens, at most 20, stored in uppercase. Build it with `parseSku`. */
export type Sku = string & Brand<"Sku">;

/**
 * The format is checked on the text as typed and the case is normalised afterwards: uppercasing
 * first would let `ß`, `ı` or `ﬁ` turn into ASCII letters (and change the length).
 */
export function parseSku(raw: string): Result<Sku, "REQUIRED" | "INVALID_FORMAT"> {
  const trimmed = raw.trim();
  if (trimmed === "") return err("REQUIRED");
  if (!SKU_PATTERN.test(trimmed)) return err("INVALID_FORMAT");
  return ok(trimmed.toUpperCase() as Sku);
}
