import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseSku } from "./sku.ts";

describe("parseSku", () => {
  it("accepts letters, digits and hyphens", () => {
    expect(parseSku("HAR-PAN-1K")).toEqual({ ok: true, value: "HAR-PAN-1K" });
  });

  it("normalises the code to uppercase", () => {
    expect(parseSku("har-pan-1k")).toEqual({ ok: true, value: "HAR-PAN-1K" });
  });

  it("ignores surrounding whitespace", () => {
    expect(parseSku("  ace-gir-1l ")).toEqual({ ok: true, value: "ACE-GIR-1L" });
  });

  it("accepts exactly 20 characters and rejects 21", () => {
    expect(parseSku("A".repeat(20)).ok).toBe(true);
    expect(parseSku("A".repeat(21))).toEqual({ ok: false, error: "INVALID_FORMAT" });
  });

  it.each(["", "   "])("rejects %j as REQUIRED", (raw) => {
    expect(parseSku(raw)).toEqual({ ok: false, error: "REQUIRED" });
  });

  it.each(["HAR PAN", "HAR_PAN", "HAR.PAN", "HAR/PAN", "ÑAME", "HAR\tPAN"])(
    "rejects %j as INVALID_FORMAT",
    (raw) => {
      expect(parseSku(raw)).toEqual({ ok: false, error: "INVALID_FORMAT" });
    },
  );

  // `ß`, `ı` and `ﬁ` become ASCII letters only when uppercased: validate before normalising.
  it.each(["ß", "ı", "ſ", "ﬁ"])("rejects %j: it is not an ASCII letter as typed", (raw) => {
    expect(parseSku(raw)).toEqual({ ok: false, error: "INVALID_FORMAT" });
  });

  it("is idempotent: a stored code parses to itself", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (raw) => {
        const first = parseSku(raw);
        if (!first.ok) return;
        expect(parseSku(first.value)).toEqual(first);
      }),
    );
  });
});
