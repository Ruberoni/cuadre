// Turns the Design System token snapshot (design-system/tokens.json) into src/styles/tokens.css.
//
// The snapshot is a verbatim copy of `project/tokens.json` from the Cuadre Design System, written
// by the `sync-design-system` skill (ADR-012). This script is pure and deterministic: the same
// snapshot always gives the same bytes, so a sync with no Design System changes produces no diff.
// Run it with `pnpm --filter @cuadre/ui tokens:generate`.
import { readFileSync, writeFileSync } from "node:fs";
import { err, ok, type Result } from "../src/lib/result.ts";

export const SNAPSHOT_URL = new URL("../design-system/tokens.json", import.meta.url);
export const TOKENS_CSS_URL = new URL("../src/styles/tokens.css", import.meta.url);

export type TokenErrorCode =
  | "INVALID_SNAPSHOT"
  | "UNSUPPORTED_THEME"
  | "UNSUPPORTED_VALUE"
  | "INVALID_TOKEN_NAME"
  | "BROKEN_SPACING_SCALE"
  | "UNKNOWN_FAMILY";

/** `CODE: detail`, so the failing token is visible in the message. */
export type TokenError = `${TokenErrorCode}: ${string}`;

type Token = { name: string; value: string };
type TextStyle = {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing?: string;
};

const KNOWN_FAMILIES = new Set([
  "name",
  "version",
  "color",
  "type",
  "spacing",
  "size",
  "radius",
  "shadow",
]);
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_FN = /^(?:rgb|rgba|hsl|hsla|oklch)\([-0-9.,%\s/a-z]*\)$/i;
const LENGTH = /^-?\d+(?:\.\d+)?(?:px|rem|em|%)?$/;
// Anything that could escape a declaration or reference another variable.
const UNSAFE = /[;{}]|\/\*|var\(/;

const fail = (code: TokenErrorCode, detail: string) => err(`${code}: ${detail}` as TokenError);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads `{ tokens: [{ name, value }] }` with a plain string value (no per-theme objects). */
function readTokens(family: string, raw: unknown): Result<Token[], TokenError> {
  if (!isRecord(raw) || !Array.isArray(raw.tokens)) {
    return fail("INVALID_SNAPSHOT", `"${family}.tokens" must be a list`);
  }
  const seen = new Set<string>();
  const tokens: Token[] = [];
  for (const entry of raw.tokens) {
    if (!isRecord(entry) || typeof entry.name !== "string") {
      return fail("INVALID_SNAPSHOT", `"${family}" has an entry without a name`);
    }
    if (!NAME.test(entry.name) || seen.has(entry.name)) {
      return fail("INVALID_TOKEN_NAME", `${family}/${entry.name}`);
    }
    seen.add(entry.name);
    if (typeof entry.value !== "string") {
      return fail("UNSUPPORTED_VALUE", `${family}/${entry.name} must have a single string value`);
    }
    if (UNSAFE.test(entry.value)) {
      return fail("UNSUPPORTED_VALUE", `${family}/${entry.name} = "${entry.value}"`);
    }
    tokens.push({ name: entry.name, value: entry.value });
  }
  return ok(tokens);
}

function readTextStyles(
  raw: unknown,
): Result<{ sans: string; styles: TextStyle[]; families: Token[] }, TokenError> {
  if (!isRecord(raw) || !isRecord(raw.families) || !Array.isArray(raw.groups)) {
    return fail("INVALID_SNAPSHOT", `"type" needs "families" and "groups"`);
  }
  const families: Token[] = [];
  for (const [name, value] of Object.entries(raw.families)) {
    if (!NAME.test(name) || typeof value !== "string" || UNSAFE.test(value)) {
      return fail("UNSUPPORTED_VALUE", `type/families/${name}`);
    }
    families.push({ name, value });
  }
  const styles: TextStyle[] = [];
  const seen = new Set<string>();
  for (const group of raw.groups) {
    if (!isRecord(group) || !Array.isArray(group.styles)) {
      return fail("INVALID_SNAPSHOT", `a "type" group has no styles`);
    }
    for (const style of group.styles) {
      if (
        !isRecord(style) ||
        typeof style.name !== "string" ||
        !NAME.test(style.name) ||
        seen.has(style.name)
      ) {
        return fail("INVALID_TOKEN_NAME", `type/${isRecord(style) ? String(style.name) : "?"}`);
      }
      seen.add(style.name);
      const fontWeight = String(style.fontWeight);
      const { fontSize, lineHeight, letterSpacing } = style;
      if (
        typeof fontSize !== "string" ||
        typeof lineHeight !== "string" ||
        !LENGTH.test(fontSize) ||
        !LENGTH.test(lineHeight) ||
        !/^\d{3}$/.test(fontWeight) ||
        (letterSpacing !== undefined &&
          (typeof letterSpacing !== "string" || UNSAFE.test(letterSpacing)))
      ) {
        return fail("UNSUPPORTED_VALUE", `type/${style.name}`);
      }
      styles.push({
        name: style.name,
        fontSize,
        lineHeight,
        fontWeight,
        ...(letterSpacing === undefined ? {} : { letterSpacing }),
      });
    }
  }
  return ok({ sans: "sans", styles, families });
}

function readColors(raw: unknown): Result<Token[], TokenError> {
  if (isRecord(raw)) {
    const themes = raw.themes;
    const onlyLight =
      Array.isArray(themes) &&
      themes.length === 1 &&
      isRecord(themes[0]) &&
      themes[0].id === "light";
    if (!onlyLight) return fail("UNSUPPORTED_THEME", "the MVP ships the light theme only");
  }
  const tokens = readTokens("color", raw);
  if (!tokens.ok) return tokens;
  for (const { name, value } of tokens.value) {
    if (!HEX.test(value) && !COLOR_FN.test(value)) {
      return fail("UNSUPPORTED_VALUE", `color/${name} = "${value}"`);
    }
  }
  return tokens;
}

function readLengths(family: string, raw: unknown): Result<Token[], TokenError> {
  const tokens = readTokens(family, raw);
  if (!tokens.ok) return tokens;
  for (const { name, value } of tokens.value) {
    if (!LENGTH.test(value)) return fail("UNSUPPORTED_VALUE", `${family}/${name} = "${value}"`);
  }
  return tokens;
}

/** Tailwind has one `--spacing` step, so the DS scale must be `space-N = N × space-1`. */
function checkSpacingScale(tokens: Token[]): Result<string, TokenError> {
  const base = tokens.find((token) => token.name === "space-1");
  const baseValue = base ? /^(\d+(?:\.\d+)?)px$/.exec(base.value)?.[1] : undefined;
  if (baseValue === undefined) return fail("BROKEN_SPACING_SCALE", "space-1 must be a px value");
  for (const { name, value } of tokens) {
    const step = /^space-(\d+)$/.exec(name)?.[1];
    if (step === undefined || value !== `${Number(step) * Number(baseValue)}px`) {
      return fail(
        "BROKEN_SPACING_SCALE",
        `${name} = "${value}" is not ${step ?? "N"} × ${base?.value}`,
      );
    }
  }
  return ok(`${baseValue}px`);
}

export function generateTokensCss(snapshot: unknown): Result<string, TokenError> {
  if (!isRecord(snapshot)) return fail("INVALID_SNAPSHOT", "the snapshot must be an object");
  for (const key of Object.keys(snapshot)) {
    if (!KNOWN_FAMILIES.has(key)) return fail("UNKNOWN_FAMILY", key);
  }

  const colors = readColors(snapshot.color);
  if (!colors.ok) return colors;
  const text = readTextStyles(snapshot.type);
  if (!text.ok) return text;
  const spacing = readLengths("spacing", snapshot.spacing);
  if (!spacing.ok) return spacing;
  const spacingStep = checkSpacingScale(spacing.value);
  if (!spacingStep.ok) return spacingStep;
  const sizes = readLengths("size", snapshot.size);
  if (!sizes.ok) return sizes;
  const radii = readLengths("radius", snapshot.radius);
  if (!radii.ok) return radii;
  const shadows = readTokens("shadow", snapshot.shadow);
  if (!shadows.ok) return shadows;

  const radiusMd = radii.value.find((token) => token.name === "radius-md");
  if (!radiusMd) return fail("INVALID_SNAPSHOT", "radius-md is required (it is shadcn's --radius)");

  const lines: string[] = [
    "/* GENERATED by scripts/generate-tokens.ts from design-system/tokens.json. Do not edit.",
    "   Tokens come from the Cuadre Design System; run the sync-design-system skill to update them. */",
    "",
    ":root {",
    ...colors.value.map(({ name, value }) => `  --${name}: ${value};`),
    ...spacing.value.map(({ name, value }) => `  --${name}: ${value};`),
    ...sizes.value.map(({ name, value }) => `  --${name}: ${value};`),
    `  --radius: ${radiusMd.value};`,
    "}",
    "",
    "/* Utilities such as bg-primary read the variables above. */",
    "@theme inline {",
    "  --color-*: initial;",
    ...colors.value.map(({ name }) => `  --color-${name}: var(--${name});`),
    "}",
    "",
    "/* Values Tailwind resolves itself. */",
    "@theme {",
    `  --spacing: ${spacingStep.value};`,
    ...text.value.families.map(({ name, value }) => `  --font-${name}: ${value};`),
    ...radii.value.map(({ name, value }) => `  --${name}: ${value};`),
    ...shadows.value.map(({ name, value }) => `  --${name}: ${value};`),
  ];
  for (const style of text.value.styles) {
    lines.push(
      `  --text-${style.name}: ${style.fontSize};`,
      `  --text-${style.name}--line-height: ${style.lineHeight};`,
      `  --text-${style.name}--font-weight: ${style.fontWeight};`,
    );
    if (style.letterSpacing !== undefined) {
      lines.push(`  --text-${style.name}--letter-spacing: ${style.letterSpacing};`);
    }
  }
  lines.push("}", "");
  return ok(lines.join("\n"));
}

/** Stable serialization of the snapshot: the same data always gives the same bytes. */
export const serializeSnapshot = (snapshot: unknown): string =>
  `${JSON.stringify(snapshot, null, 2)}\n`;

// `--from <file>`: first replace the snapshot with a fresh copy of the Design System's
// `project/tokens.json` (what the sync-design-system skill does), then generate.
if (import.meta.main) {
  const fromIndex = process.argv.indexOf("--from");
  const source = fromIndex === -1 ? undefined : process.argv[fromIndex + 1];
  if (fromIndex !== -1 && source === undefined) {
    process.stderr.write(
      "tokens:generate: --from needs the path of the Design System tokens.json\n",
    );
    process.exit(1);
  }
  const snapshot: unknown = JSON.parse(readFileSync(source ?? SNAPSHOT_URL, "utf8"));
  const result = generateTokensCss(snapshot);
  if (!result.ok) {
    // Nothing is written: a rejected snapshot must not replace the committed one.
    process.stderr.write(`tokens:generate failed: ${result.error}\n`);
    process.exit(1);
  }
  if (source !== undefined) writeFileSync(SNAPSHOT_URL, serializeSnapshot(snapshot));
  writeFileSync(TOKENS_CSS_URL, result.value);
  process.stdout.write(
    `Wrote ${source === undefined ? "" : "design-system/tokens.json and "}src/styles/tokens.css\n`,
  );
}
