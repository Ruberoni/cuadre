import { TAX_RATE_PERCENT } from "@cuadre/contracts";
import { describe, expect, it } from "vitest";
import { parseTaxRate } from "./tax-rate.ts";

describe("parseTaxRate", () => {
  it("knows the IVA rates: general 16 %, reduced 8 %, exempt", () => {
    expect(TAX_RATE_PERCENT).toEqual({ GENERAL: 16, REDUCED: 8, EXEMPT: 0 });
  });

  it.each(["GENERAL", "REDUCED", "EXEMPT"])("accepts %s", (rate) => {
    expect(parseTaxRate(rate)).toEqual({ ok: true, value: rate });
  });

  it.each(["", "general", "16", "ZERO"])("rejects %j as INVALID", (raw) => {
    expect(parseTaxRate(raw)).toEqual({ ok: false, error: "INVALID" });
  });
});
