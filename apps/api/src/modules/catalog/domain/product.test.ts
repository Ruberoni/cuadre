import { MAX_MINOR_UNITS } from "@cuadre/shared-kernel";
import { describe, expect, it } from "vitest";
import { createProduct, type ProductInput } from "./product.ts";

const valid: ProductInput = {
  sku: "har-pan-1k",
  name: "Harina de maíz precocida 1 kg",
  unitOfMeasure: "BULK",
  salePrice: { minorUnits: 145, currency: "USD" },
  taxRate: "EXEMPT",
};

const issuesOf = (input: ProductInput) => {
  const result = createProduct(input);
  if (result.ok) throw new Error("expected a validation failure");
  return result.issues;
};

describe("createProduct", () => {
  it("builds a product from valid input, with the code normalised and the price in USD", () => {
    const result = createProduct(valid);

    expect(result).toEqual({
      ok: true,
      value: {
        sku: "HAR-PAN-1K",
        name: "Harina de maíz precocida 1 kg",
        unitOfMeasure: "BULK",
        salePrice: { minorUnits: 145, currency: "USD" },
        taxRate: "EXEMPT",
      },
    });
  });

  it("reports every invalid field at once, not just the first", () => {
    const issues = issuesOf({
      sku: "HAR PAN",
      name: "",
      unitOfMeasure: "PALLET",
      salePrice: { minorUnits: 0, currency: "USD" },
      taxRate: "ZERO",
    });

    expect(issues).toEqual([
      { field: "sku", code: "INVALID_FORMAT" },
      { field: "name", code: "REQUIRED" },
      { field: "unitOfMeasure", code: "INVALID" },
      { field: "salePrice", code: "NOT_POSITIVE" },
      { field: "taxRate", code: "INVALID" },
    ]);
  });

  it("rejects a price of 0 and a negative price as NOT_POSITIVE", () => {
    for (const minorUnits of [0, -1]) {
      expect(issuesOf({ ...valid, salePrice: { minorUnits, currency: "USD" } })).toEqual([
        { field: "salePrice", code: "NOT_POSITIVE" },
      ]);
    }
  });

  it("accepts the smallest price, 0,01", () => {
    expect(createProduct({ ...valid, salePrice: { minorUnits: 1, currency: "USD" } }).ok).toBe(
      true,
    );
  });

  it("rejects a price in any currency but USD", () => {
    expect(issuesOf({ ...valid, salePrice: { minorUnits: 145, currency: "VES" } })).toEqual([
      { field: "salePrice", code: "INVALID" },
    ]);
  });

  it("rejects fractional minor units as INVALID, never rounding them", () => {
    expect(issuesOf({ ...valid, salePrice: { minorUnits: 1.5, currency: "USD" } })).toEqual([
      { field: "salePrice", code: "INVALID" },
    ]);
  });

  it("rejects an amount beyond the Money range as OUT_OF_RANGE", () => {
    const salePrice = { minorUnits: MAX_MINOR_UNITS + 1, currency: "USD" };
    expect(issuesOf({ ...valid, salePrice })).toEqual([
      { field: "salePrice", code: "OUT_OF_RANGE" },
    ]);
  });

  it("rejects a name over 120 characters as TOO_LONG", () => {
    expect(issuesOf({ ...valid, name: "a".repeat(121) })).toEqual([
      { field: "name", code: "TOO_LONG" },
    ]);
  });
});
