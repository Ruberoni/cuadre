// Finds color values written by hand. Semantic tokens live in tokens.css (ADR-012),
// so source files may use semantic classes (`bg-primary`) but never literals. Because tokens.css
// resets Tailwind's palette (`--color-*: initial`), classes from the default palette do nothing;
// they are flagged too.

const PALETTE_NAMES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITIES =
  "bg|text|border|ring|fill|stroke|outline|from|to|via|divide|shadow|decoration|accent|caret";

const RULES: { reason: string; pattern: RegExp }[] = [
  {
    reason: "hex color",
    // `href="#add"` is an anchor, not a color.
    pattern: /(?<!href=["'])(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g,
  },
  {
    reason: "color function",
    pattern: /\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color-mix)\(/g,
  },
  {
    reason: "Tailwind default palette (reset by tokens.css)",
    pattern: new RegExp(
      `\\b(?:${COLOR_UTILITIES})-(?:black|white|(?:${PALETTE_NAMES})-\\d{2,3})\\b`,
      "g",
    ),
  },
];

export type HardcodedValue = { line: number; match: string; reason: string };

export function findHardcodedValues(source: string): HardcodedValue[] {
  const found: HardcodedValue[] = [];
  for (const [index, text] of source.split("\n").entries()) {
    for (const { reason, pattern } of RULES) {
      for (const match of text.matchAll(pattern)) {
        found.push({ line: index + 1, match: match[0], reason });
      }
    }
  }
  return found;
}
