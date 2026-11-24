import { describe, expect, it } from "vitest";
import { createCustomer, createSupplier, reconstitutePartner } from "./partner.ts";

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

describe("createCustomer", () => {
  it("creates a normalised company customer with optional contact fields", () => {
    const result = createCustomer({
      rif: "j409876543",
      name: "  Abastos La Esquina, C.A.  ",
      phone: " +58 212-555-0201 ",
      email: " Compras@LaEsquina.test ",
      address: " Av. Francisco de Miranda, Chacao, Caracas ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rif: "J-40987654-3",
        name: "Abastos La Esquina, C.A.",
        phone: "+58 212-555-0201",
        email: "compras@laesquina.test",
        address: "Av. Francisco de Miranda, Chacao, Caracas",
        isSupplier: false,
        isCustomer: true,
      },
    });
  });

  it("accepts an individual customer with RIF V-12345678-1", () => {
    const result = createCustomer({
      rif: "v123456781",
      name: "María Elena González",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rif: "V-12345678-1",
        name: "María Elena González",
        phone: null,
        email: null,
        address: null,
        isSupplier: false,
        isCustomer: true,
      },
    });
  });

  it("defaults omitted optional contact fields to null", () => {
    const result = createCustomer({
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        rif: "J-40987654-3",
        name: "Abastos La Esquina, C.A.",
        phone: null,
        email: null,
        address: null,
        isSupplier: false,
        isCustomer: true,
      },
    });
  });

  it("reports all invalid fields at once", () => {
    const result = createCustomer({
      rif: "V-12345678-9",
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
  it("rebuilds a valid supplier-only partner row", () => {
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

  it("rebuilds a valid customer-only and dual-role partner row", () => {
    const customerOnly = reconstitutePartner({
      id: "00000000-0000-4000-8000-000000000002",
      rif: "V-12345678-1",
      name: "María Elena González",
      phone: null,
      email: null,
      address: null,
      isSupplier: false,
      isCustomer: true,
    });
    expect(customerOnly.ok).toBe(true);

    const both = reconstitutePartner({
      id: "00000000-0000-4000-8000-000000000003",
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: null,
      email: null,
      address: null,
      isSupplier: true,
      isCustomer: true,
    });
    expect(both.ok).toBe(true);
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
