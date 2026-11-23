import { describe, expect, it } from "vitest";
import { createSupplier, reconstitutePartner } from "./partner.ts";

describe("createSupplier", () => {
  it("creates a normalised supplier with optional contact fields", () => {
    const result = createSupplier({
      rif: "j301234561",
      name: "  Distribuidora Andina, C.A.  ",
      phone: " +58 212-555-0101 ",
      email: " Compras@Andina.com.ve ",
      address: " Zona Industrial La Yaguara, Caracas ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rif: "J-30123456-1",
        name: "Distribuidora Andina, C.A.",
        phone: "+58 212-555-0101",
        email: "compras@andina.com.ve",
        address: "Zona Industrial La Yaguara, Caracas",
        isSupplier: true,
        isCustomer: false,
      },
    });
  });

  it("defaults omitted optional contact fields to null", () => {
    const result = createSupplier({
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rif: "J-30123456-1",
        name: "Distribuidora Andina, C.A.",
        phone: null,
        email: null,
        address: null,
        isSupplier: true,
        isCustomer: false,
      },
    });
  });

  it("reports all invalid fields at once", () => {
    const result = createSupplier({
      rif: "J-30123456-7",
      name: "   ",
      email: "bad-email",
    });

    expect(result).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "rif", code: "INVALID_CHECK_DIGIT" },
        { field: "name", code: "REQUIRED" },
        { field: "email", code: "INVALID_FORMAT" },
      ],
    });
  });
});

describe("reconstitutePartner", () => {
  it("rebuilds a valid partner row", () => {
    const partner = reconstitutePartner({
      id: "00000000-0000-4000-8000-000000000001",
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: null,
      email: null,
      address: null,
      isSupplier: true,
      isCustomer: false,
    });
    expect(partner.ok).toBe(true);
  });

  it("fails loudly if a row has neither supplier nor customer role", () => {
    const partner = reconstitutePartner({
      id: "00000000-0000-4000-8000-000000000001",
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: null,
      email: null,
      address: null,
      isSupplier: false,
      isCustomer: false,
    });
    expect(partner.ok).toBe(false);
  });
});
