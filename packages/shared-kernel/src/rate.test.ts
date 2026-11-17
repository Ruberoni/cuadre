import { describe, expect, it } from "vitest";
import { unwrap } from "../test/unwrap.ts";
import { parseRate, rateToString } from "./index.ts";

describe("parseRate", () => {
  it("reads 36.5123 as 36.51230000", () => {
    const rate = unwrap(parseRate("36.5123"));
    expect(rate.scaled).toBe(3_651_230_000n);
    expect(rateToString(rate)).toBe("36.51230000");
  });

  it.each([
    ["36", "36.00000000"],
    ["36.51234567", "36.51234567"],
    ["0.5", "0.50000000"],
    ["0.00000001", "0.00000001"],
    ["999999999999.99999999", "999999999999.99999999"],
  ])("%s → %s", (text, expected) => {
    expect(rateToString(unwrap(parseRate(text)))).toBe(expected);
  });

  it("rejects more than 8 decimals instead of rounding", () => {
    expect(parseRate("36.123456789")).toEqual({ ok: false, error: "INVALID_RATE" });
  });

  it.each(["0", "0.0", "0.00000000", "-1", "-36.5"])("rejects %j (not > 0)", (text) => {
    expect(parseRate(text)).toEqual({ ok: false, error: "INVALID_RATE" });
  });

  it.each(["", "abc", "36.", ".5", "00.5", "36,5", " 36.5", "36.5 ", "1e3", "+1"])(
    "rejects the malformed %j",
    (text) => {
      expect(parseRate(text)).toEqual({ ok: false, error: "INVALID_RATE" });
    },
  );
});
