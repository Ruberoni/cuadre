import { PARTNER_NAME_MAX_LENGTH } from "@cuadre/contracts";
import { type Brand, err, ok, type Result } from "@cuadre/shared-kernel";

/** Razón social: legal name of a partner. Build it with `parsePartnerName`. */
export type PartnerName = string & Brand<"PartnerName">;

export function parsePartnerName(raw: string): Result<PartnerName, "REQUIRED" | "TOO_LONG"> {
  const trimmed = raw.trim();
  if (trimmed === "") return err("REQUIRED");
  if (trimmed.length > PARTNER_NAME_MAX_LENGTH) return err("TOO_LONG");
  return ok(trimmed as PartnerName);
}
