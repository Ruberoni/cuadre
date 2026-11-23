import type { Brand } from "./brand.ts";
import { err, ok, type Result } from "./result.ts";

/** Valid Venezuelan RIF prefix letters. */
export const RIF_LETTERS = ["V", "E", "J", "P", "G"] as const;
export type RifLetter = (typeof RIF_LETTERS)[number];

/** Canonical Venezuelan RIF (`L-NNNNNNNN-C`). Build it with `parseRif`. */
export type Rif = string & Brand<"Rif">;

export type RifError = "REQUIRED" | "INVALID_FORMAT" | "INVALID_CHECK_DIGIT";

const LETTER_VALUE: Record<RifLetter, number> = {
  V: 1,
  E: 2,
  J: 3,
  P: 4,
  G: 5,
};

const WEIGHTS = [4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

const HYPHENATED_RIF = /^([VEJPGvejpg])-([0-9]{1,8})-([0-9])$/;
const UNHYPHENATED_RIF = /^([VEJPGvejpg])([0-9]{8})([0-9])$/;

/**
 * Computes the SENIAT modulus-11 check digit for a RIF letter and its 8-digit body.
 * Weights 4-3-2-7-6-5-4-3-2 over letter value (V=1, E=2, J=3, P=4, G=5) and the 8 digits;
 * check digit is `11 - remainder`, with 10 and 11 mapped to 0.
 */
export function computeRifCheckDigit(letter: RifLetter, eightDigits: string): number {
  let sum = LETTER_VALUE[letter] * WEIGHTS[0];
  for (let i = 0; i < 8; i++) {
    const digit = Number(eightDigits[i]);
    const weight = WEIGHTS[i + 1];
    if (weight === undefined) break;
    sum += digit * weight;
  }
  const digit = 11 - (sum % 11);
  return digit >= 10 ? 0 : digit;
}

/**
 * Normalises and validates a Venezuelan RIF (`L-NNNNNNNN-C`).
 * Hyphenated inputs with fewer than 8 body digits are zero-padded; unhyphenated inputs require
 * all 9 digits (8 body + 1 check digit).
 */
export function parseRif(raw: string): Result<Rif, RifError> {
  const trimmed = raw.trim();
  if (trimmed === "") return err("REQUIRED");

  const hyphenated = HYPHENATED_RIF.exec(trimmed);
  const unhyphenated = hyphenated === null ? UNHYPHENATED_RIF.exec(trimmed) : null;
  const match = hyphenated ?? unhyphenated;
  if (match === null) return err("INVALID_FORMAT");

  const rawLetter = match[1];
  const rawDigits = match[2];
  const rawCheck = match[3];
  if (rawLetter === undefined || rawDigits === undefined || rawCheck === undefined) {
    return err("INVALID_FORMAT");
  }

  const letter = rawLetter.toUpperCase() as RifLetter;
  const digits = rawDigits.padStart(8, "0");
  const checkDigit = Number(rawCheck);

  if (computeRifCheckDigit(letter, digits) !== checkDigit) {
    return err("INVALID_CHECK_DIGIT");
  }

  return ok(`${letter}-${digits}-${checkDigit}` as Rif);
}
