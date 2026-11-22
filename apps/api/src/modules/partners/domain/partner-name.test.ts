import { PARTNER_NAME_MAX_LENGTH } from "@cuadre/contracts";
import { describe, expect, it } from "vitest";
import { parsePartnerName } from "./partner-name.ts";

describe("parsePartnerName", () => {
  it("trims and accepts a valid legal name", () => {
    expect(parsePartnerName("  Distribuidora Andina, C.A.  ")).toEqual({
      ok: true,
      value: "Distribuidora Andina, C.A.",
    });
  });

  it("rejects empty and whitespace-only names as REQUIRED", () => {
    expect(parsePartnerName("")).toEqual({ ok: false, error: "REQUIRED" });
    expect(parsePartnerName("   ")).toEqual({ ok: false, error: "REQUIRED" });
  });

  it("rejects names longer than PARTNER_NAME_MAX_LENGTH as TOO_LONG", () => {
    expect(parsePartnerName("A".repeat(PARTNER_NAME_MAX_LENGTH))).toEqual({
      ok: true,
      value: "A".repeat(PARTNER_NAME_MAX_LENGTH),
    });
    expect(parsePartnerName("A".repeat(PARTNER_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: "TOO_LONG",
    });
  });
});
