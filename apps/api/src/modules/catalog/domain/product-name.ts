import { PRODUCT_NAME_MAX_LENGTH } from "@cuadre/contracts";
import { type Brand, err, ok, type Result } from "@cuadre/shared-kernel";

export type ProductName = string & Brand<"ProductName">;

export function parseProductName(raw: string): Result<ProductName, "REQUIRED" | "TOO_LONG"> {
  const trimmed = raw.trim();
  if (trimmed === "") return err("REQUIRED");
  if (trimmed.length > PRODUCT_NAME_MAX_LENGTH) return err("TOO_LONG");
  return ok(trimmed as ProductName);
}
