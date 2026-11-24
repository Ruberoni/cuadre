import { describe, expect, it } from "vitest";
import { parseQuantity, QUANTITY_SCALE, quantityToString } from "./quantity.ts";

describe("parseQuantity", () => {
  it("accepts whole numbers for whole-number units", () => {
    const result = parseQuantity("100", { allowDecimals: false });
    expect(result).toEqual({ ok: true, value: { scaled: 100n * QUANTITY_SCALE } });
    if (result.ok) expect(quantityToString(result.value)).toBe("100");
  });

  it("rejects fractional values for whole-number units with QUANTITY_NOT_WHOLE (2.5 Bulto)", () => {
    expect(parseQuantity("2.5", { allowDecimals: false })).toEqual({
      ok: false,
      error: "QUANTITY_NOT_WHOLE",
    });
  });

  it("accepts up to 3 decimals for decimal units (12.345 Kilogramo)", () => {
    const result = parseQuantity("12.345", { allowDecimals: true });
    expect(result).toEqual({ ok: true, value: { scaled: 12345n } });
    if (result.ok) expect(quantityToString(result.value)).toBe("12.345");
  });

  it("rejects more than 3 decimals with QUANTITY_TOO_PRECISE (12.3456)", () => {
    expect(parseQuantity("12.3456", { allowDecimals: true })).toEqual({
      ok: false,
      error: "QUANTITY_TOO_PRECISE",
    });
  });

  it("strips trailing zeros when formatting canonical strings", () => {
    const result = parseQuantity("12.500", { allowDecimals: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(quantityToString(result.value)).toBe("12.5");
  });

  it("rejects empty, zero, negative, malformed and out-of-range values", () => {
    expect(parseQuantity("   ", { allowDecimals: false })).toEqual({
      ok: false,
      error: "REQUIRED",
    });
    expect(parseQuantity("0", { allowDecimals: false })).toEqual({
      ok: false,
      error: "NOT_POSITIVE",
    });
    expect(parseQuantity("0.000", { allowDecimals: true })).toEqual({
      ok: false,
      error: "NOT_POSITIVE",
    });
    expect(parseQuantity("-5", { allowDecimals: false })).toEqual({
      ok: false,
      error: "INVALID_FORMAT",
    });
    expect(parseQuantity("abc", { allowDecimals: true })).toEqual({
      ok: false,
      error: "INVALID_FORMAT",
    });
    expect(parseQuantity("1000000000001", { allowDecimals: false })).toEqual({
      ok: false,
      error: "OUT_OF_RANGE",
    });
  });
});
