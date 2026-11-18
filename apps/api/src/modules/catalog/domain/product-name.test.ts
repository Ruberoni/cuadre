import { describe, expect, it } from "vitest";
import { parseProductName } from "./product-name.ts";

describe("parseProductName", () => {
  it("trims the name", () => {
    expect(parseProductName("  Harina de maíz precocida 1 kg ")).toEqual({
      ok: true,
      value: "Harina de maíz precocida 1 kg",
    });
  });

  it.each(["", "   "])("rejects %j as REQUIRED", (raw) => {
    expect(parseProductName(raw)).toEqual({ ok: false, error: "REQUIRED" });
  });

  it("accepts 120 characters and rejects 121", () => {
    expect(parseProductName("a".repeat(120)).ok).toBe(true);
    expect(parseProductName("a".repeat(121))).toEqual({ ok: false, error: "TOO_LONG" });
  });
});
