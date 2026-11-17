import { UNITS_OF_MEASURE } from "@cuadre/contracts";
import { describe, expect, it } from "vitest";
import { parseUnitOfMeasure } from "./unit-of-measure.ts";

describe("parseUnitOfMeasure", () => {
  it("offers the fixed list in order: Unidad, Caja, Bulto, Kilogramo, Litro", () => {
    expect(UNITS_OF_MEASURE).toEqual(["UNIT", "BOX", "BULK", "KILOGRAM", "LITER"]);
  });

  it.each(UNITS_OF_MEASURE)("accepts %s", (unit) => {
    expect(parseUnitOfMeasure(unit)).toEqual({ ok: true, value: unit });
  });

  it.each(["", "unit", "PALLET"])("rejects %j as INVALID", (raw) => {
    expect(parseUnitOfMeasure(raw)).toEqual({ ok: false, error: "INVALID" });
  });
});
