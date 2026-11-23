import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_EMAIL_MAX_LENGTH,
  PARTNER_PHONE_MAX_LENGTH,
} from "@cuadre/contracts";
import { describe, expect, it } from "vitest";
import { parsePartnerAddress, parsePartnerEmail, parsePartnerPhone } from "./partner-contact.ts";

describe("parsePartnerPhone", () => {
  it("normalises missing or blank values to null", () => {
    expect(parsePartnerPhone(undefined)).toEqual({ ok: true, value: null });
    expect(parsePartnerPhone(null)).toEqual({ ok: true, value: null });
    expect(parsePartnerPhone("   ")).toEqual({ ok: true, value: null });
  });

  it("trims valid phone strings and enforces max length", () => {
    expect(parsePartnerPhone("  +58 212-555-0199  ")).toEqual({
      ok: true,
      value: "+58 212-555-0199",
    });
    expect(parsePartnerPhone("1".repeat(PARTNER_PHONE_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: "TOO_LONG",
    });
  });
});

describe("parsePartnerEmail", () => {
  it("normalises missing or blank values to null", () => {
    expect(parsePartnerEmail(undefined)).toEqual({ ok: true, value: null });
    expect(parsePartnerEmail(null)).toEqual({ ok: true, value: null });
    expect(parsePartnerEmail("  ")).toEqual({ ok: true, value: null });
  });

  it("trims and lowercases valid emails", () => {
    expect(parsePartnerEmail("  Ventas@Andina.COM.VE  ")).toEqual({
      ok: true,
      value: "ventas@andina.com.ve",
    });
  });

  it("rejects invalid email formats and overly long addresses", () => {
    expect(parsePartnerEmail("not-an-email")).toEqual({ ok: false, error: "INVALID_FORMAT" });
    expect(parsePartnerEmail("a@b")).toEqual({ ok: false, error: "INVALID_FORMAT" });
    expect(parsePartnerEmail(`${"a".repeat(PARTNER_EMAIL_MAX_LENGTH)}@example.com`)).toEqual({
      ok: false,
      error: "TOO_LONG",
    });
  });
});

describe("parsePartnerAddress", () => {
  it("normalises missing or blank values to null", () => {
    expect(parsePartnerAddress(undefined)).toEqual({ ok: true, value: null });
    expect(parsePartnerAddress(null)).toEqual({ ok: true, value: null });
    expect(parsePartnerAddress("")).toEqual({ ok: true, value: null });
  });

  it("trims valid addresses and enforces max length", () => {
    expect(parsePartnerAddress("  Av. Francisco de Miranda, Caracas  ")).toEqual({
      ok: true,
      value: "Av. Francisco de Miranda, Caracas",
    });
    expect(parsePartnerAddress("x".repeat(PARTNER_ADDRESS_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: "TOO_LONG",
    });
  });
});
