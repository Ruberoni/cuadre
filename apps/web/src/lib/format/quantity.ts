// es-VE quantity formatting and parsing (Design System → Formatting, ADR-005).
// Works on exact decimal strings, never floats.
import { err, ok, parseQuantity, type QuantityError, type Result } from "@cuadre/shared-kernel";
import { groupThousands } from "./money.ts";

/** Canonical dot-decimal `"1234.5"` → es-VE `"1.234,5"`, `"100"` → `"100"`. */
export function formatQuantity(canonical: string): string {
  const [whole = "0", frac] = canonical.split(".");
  const grouped = groupThousands(whole);
  return frac === undefined || frac === "" ? grouped : `${grouped},${frac}`;
}

const GROUPED = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,(\d+))?$/;
const PLAIN = /^\d+(?:,(\d+))?$/;

/**
 * Parses an es-VE quantity string (`12,345`, `1.000`, `2,5`) into a canonical dot-decimal string
 * (`"12.345"`, `"1000"`), enforcing whole-number vs up-to-3-decimal rules without floats.
 */
export function parseQuantityInput(
  input: string,
  { allowDecimals }: { allowDecimals: boolean },
): Result<string, QuantityError> {
  const text = input.trim();
  if (text === "") return err("REQUIRED");

  const match = GROUPED.exec(text) ?? PLAIN.exec(text);
  if (match === null) return err("INVALID_FORMAT");

  const [integerRaw = "", fracRaw] = text.split(",");
  const integerPart = integerRaw.replaceAll(".", "");
  const canonical = fracRaw === undefined ? integerPart : `${integerPart}.${fracRaw}`;

  const parsed = parseQuantity(canonical, { allowDecimals });
  if (!parsed.ok) return err(parsed.error);

  const whole = parsed.value.scaled / 1000n;
  const frac = parsed.value.scaled % 1000n;
  if (frac === 0n) return ok(whole.toString());
  return ok(`${whole.toString()}.${frac.toString().padStart(3, "0").replace(/0+$/, "")}`);
}
