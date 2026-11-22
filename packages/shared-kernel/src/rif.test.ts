import { describe, expect, it } from "vitest";
import { computeRifCheckDigit, parseRif } from "./rif.ts";

describe("parseRif", () => {
  it("accepts a canonical RIF", () => {
    expect(parseRif("J-30123456-1")).toEqual({ ok: true, value: "J-30123456-1" });
  });

  it("normalises lowercase unhyphenated input to canonical format", () => {
    expect(parseRif("j301234561")).toEqual({ ok: true, value: "J-30123456-1" });
    expect(parseRif("  j301234561  ")).toEqual({ ok: true, value: "J-30123456-1" });
  });

  it("zero-pads hyphenated RIFs whose body has fewer than 8 digits", () => {
    const check = computeRifCheckDigit("V", "01234567");
    expect(parseRif(`v-1234567-${check}`)).toEqual({
      ok: true,
      value: `V-01234567-${check}`,
    });
  });

  it("validates real published Venezuelan RIFs", () => {
    // BCV (remainder 0 -> 11 -> 0), SENIAT (remainder 0 -> 0), Alimentos Polar (9), CANTV (5),
    // Mercantil Banco (remainder 1 -> 10 -> 0).
    for (const rif of [
      "G-20000110-0",
      "G-20000303-0",
      "J-00006372-9",
      "J-00124134-5",
      "J-00002961-0",
    ]) {
      expect(parseRif(rif), rif).toEqual({ ok: true, value: rif });
    }
  });

  it("rejects empty and whitespace-only input as REQUIRED", () => {
    expect(parseRif("")).toEqual({ ok: false, error: "REQUIRED" });
    expect(parseRif("   ")).toEqual({ ok: false, error: "REQUIRED" });
  });

  it("rejects wrong check digit as INVALID_CHECK_DIGIT", () => {
    expect(parseRif("J-30123456-7")).toEqual({ ok: false, error: "INVALID_CHECK_DIGIT" });
    expect(parseRif("j301234567")).toEqual({ ok: false, error: "INVALID_CHECK_DIGIT" });
  });

  it("rejects malformed inputs as INVALID_FORMAT", () => {
    for (const bad of [
      "J-123",
      "J123",
      "V12345678",
      "X-30123456-1",
      "J-123456789-0",
      "J-30123456-12",
      "J--30123456-1",
      "30123456-1",
      "J-3012345A-1",
    ]) {
      expect(parseRif(bad), bad).toEqual({ ok: false, error: "INVALID_FORMAT" });
    }
  });
});
