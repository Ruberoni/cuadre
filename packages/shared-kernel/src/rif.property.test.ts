import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeRifCheckDigit, parseRif, RIF_LETTERS, type RifLetter } from "./rif.ts";

const rifLetter = fc.constantFrom<RifLetter>(...RIF_LETTERS);
const eightDigits = fc.integer({ min: 0, max: 99_999_999 }).map((n) => String(n).padStart(8, "0"));

describe("Rif properties", () => {
  it("for any letter and 8 digits, the computed check digit validates", () => {
    fc.assert(
      fc.property(rifLetter, eightDigits, (letter, digits) => {
        const check = computeRifCheckDigit(letter, digits);
        const canonical = `${letter}-${digits}-${check}`;
        expect(parseRif(canonical)).toEqual({ ok: true, value: canonical });
      }),
    );
  });

  it("normalising then parsing a valid RIF is idempotent across casing and hyphenation", () => {
    fc.assert(
      fc.property(
        rifLetter,
        eightDigits,
        fc.boolean(),
        fc.boolean(),
        (letter, digits, lower, hyphens) => {
          const check = computeRifCheckDigit(letter, digits);
          const l = lower ? letter.toLowerCase() : letter;
          const raw = hyphens ? `${l}-${digits}-${check}` : `${l}${digits}${check}`;
          const first = parseRif(raw);
          expect(first.ok).toBe(true);
          if (!first.ok) return;
          expect(parseRif(first.value)).toEqual(first);
        },
      ),
    );
  });

  it("any other check digit fails with INVALID_CHECK_DIGIT", () => {
    fc.assert(
      fc.property(
        rifLetter,
        eightDigits,
        fc.integer({ min: 1, max: 9 }),
        (letter, digits, offset) => {
          const validCheck = computeRifCheckDigit(letter, digits);
          const wrongCheck = (validCheck + offset) % 10;
          expect(parseRif(`${letter}-${digits}-${wrongCheck}`)).toEqual({
            ok: false,
            error: "INVALID_CHECK_DIGIT",
          });
        },
      ),
    );
  });
});
