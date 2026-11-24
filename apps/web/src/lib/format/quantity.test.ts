import { describe, expect, it } from "vitest";
import { formatQuantity, parseQuantityInput } from "./quantity.ts";

describe("formatQuantity & parseQuantityInput", () => {
  it("formats canonical quantities in es-VE", () => {
    expect(formatQuantity("100")).toBe("100");
    expect(formatQuantity("1234")).toBe("1.234");
    expect(formatQuantity("12.345")).toBe("12,345");
    expect(formatQuantity("1234.5")).toBe("1.234,5");
  });

  it("parses whole and decimal quantities and enforces unit precision", () => {
    expect(parseQuantityInput("100", { allowDecimals: false })).toEqual({ ok: true, value: "100" });
    expect(parseQuantityInput("1.000", { allowDecimals: false })).toEqual({
      ok: true,
      value: "1000",
    });
    expect(parseQuantityInput("2,5", { allowDecimals: false })).toEqual({
      ok: false,
      error: "QUANTITY_NOT_WHOLE",
    });
    expect(parseQuantityInput("12,345", { allowDecimals: true })).toEqual({
      ok: true,
      value: "12.345",
    });
    expect(parseQuantityInput("12,3456", { allowDecimals: true })).toEqual({
      ok: false,
      error: "QUANTITY_TOO_PRECISE",
    });
    expect(parseQuantityInput("", { allowDecimals: true })).toEqual({
      ok: false,
      error: "REQUIRED",
    });
  });
});
