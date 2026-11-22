import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_EMAIL_MAX_LENGTH,
  PARTNER_PHONE_MAX_LENGTH,
} from "@cuadre/contracts";
import { err, ok, type Result } from "@cuadre/shared-kernel";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parsePartnerPhone(
  raw: string | null | undefined,
): Result<string | null, "TOO_LONG"> {
  if (raw === undefined || raw === null) return ok(null);
  const trimmed = raw.trim();
  if (trimmed === "") return ok(null);
  if (trimmed.length > PARTNER_PHONE_MAX_LENGTH) return err("TOO_LONG");
  return ok(trimmed);
}

export function parsePartnerEmail(
  raw: string | null | undefined,
): Result<string | null, "INVALID_FORMAT" | "TOO_LONG"> {
  if (raw === undefined || raw === null) return ok(null);
  const trimmed = raw.trim();
  if (trimmed === "") return ok(null);
  if (trimmed.length > PARTNER_EMAIL_MAX_LENGTH) return err("TOO_LONG");
  if (!EMAIL_PATTERN.test(trimmed)) return err("INVALID_FORMAT");
  return ok(trimmed.toLowerCase());
}

export function parsePartnerAddress(
  raw: string | null | undefined,
): Result<string | null, "TOO_LONG"> {
  if (raw === undefined || raw === null) return ok(null);
  const trimmed = raw.trim();
  if (trimmed === "") return ok(null);
  if (trimmed.length > PARTNER_ADDRESS_MAX_LENGTH) return err("TOO_LONG");
  return ok(trimmed);
}
