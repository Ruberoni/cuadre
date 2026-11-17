import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  generateTokensCss,
  SNAPSHOT_URL,
  serializeSnapshot,
  TOKENS_CSS_URL,
} from "./generate-tokens.ts";

type Token = { name: string; value: string };
type Snapshot = {
  color: { themes: { id: string }[]; tokens: Token[] };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  [family: string]: unknown;
};

const snapshot = (): Snapshot => JSON.parse(readFileSync(SNAPSHOT_URL, "utf8"));
const generate = (data: unknown) => {
  const result = generateTokensCss(data);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const errorOf = (data: unknown) => {
  const result = generateTokensCss(data);
  return result.ok ? undefined : result.error;
};

describe("generateTokensCss", () => {
  it("matches the committed tokens.css (drift between snapshot and CSS fails here)", () => {
    expect(generate(snapshot())).toBe(readFileSync(TOKENS_CSS_URL, "utf8"));
  });

  it("keeps the snapshot in stable serialization, so a re-sync gives no diff", () => {
    expect(readFileSync(SNAPSHOT_URL, "utf8")).toBe(serializeSnapshot(snapshot()));
  });

  it("is idempotent", () => {
    expect(generate(snapshot())).toBe(generate(snapshot()));
  });

  it("emits every Design System color as a variable and as a Tailwind color", () => {
    const css = generate(snapshot());
    const colors = snapshot().color.tokens;
    expect(colors).toHaveLength(40);
    for (const { name, value } of colors) {
      expect(css).toContain(`  --${name}: ${value};`);
      expect(css).toContain(`  --color-${name}: var(--${name});`);
    }
  });

  it("resets Tailwind's default palette", () => {
    expect(generate(snapshot())).toContain("--color-*: initial;");
  });

  it("resets Tailwind's default radii and shadows, then emits the Design System's own", () => {
    const css = generate(snapshot());
    expect(css).toContain("--radius-*: initial;");
    expect(css).toContain("--shadow-*: initial;");
    expect(css).toContain("--shadow-popover: 0 4px 12px rgba(10, 10, 10, 0.08)");
    expect(css).toContain("--shadow-dialog: 0 16px 40px rgba(10, 10, 10, 0.16);");
    expect(css).toContain("--radius-sm: 4px;");
    expect(css).toContain("--radius-md: 6px;");
    expect(css).toContain("--radius-lg: 8px;");
  });

  it("derives Tailwind's spacing step from space-1", () => {
    expect(generate(snapshot())).toContain("--spacing: 4px;");
  });

  it("emits Inter and the text styles", () => {
    const css = generate(snapshot());
    expect(css).toContain(
      '--font-sans: "Inter", ui-sans-serif, system-ui, "Segoe UI", sans-serif;',
    );
    expect(css).toContain("--text-page-title: 20px;");
    expect(css).toContain("--text-page-title--letter-spacing: -0.01em;");
    expect(css).toContain("--text-table--line-height: 20px;");
  });

  it("is light only: no dark theme, no values shadcn's CLI would add", () => {
    expect(generate(snapshot())).not.toMatch(/\.dark|oklch|--chart-/);
  });

  it("fails on a spacing scale Tailwind cannot represent", () => {
    const data = snapshot();
    data.spacing.tokens = data.spacing.tokens.map((token) =>
      token.name === "space-6" ? { ...token, value: "20px" } : token,
    );
    expect(errorOf(data)).toMatch(/^BROKEN_SPACING_SCALE: space-6/);
  });

  it.each(["{primary}", "var(--x)", "red; --evil: 1", "transparent"])(
    "fails on the unsupported color value %s",
    (value) => {
      const data = snapshot();
      data.color.tokens[0] = { name: "background", value };
      expect(errorOf(data)).toMatch(/^UNSUPPORTED_VALUE: .*background/);
    },
  );

  it("fails when a second theme appears", () => {
    const data = snapshot();
    data.color.themes.push({ id: "dark" });
    expect(errorOf(data)).toMatch(/^UNSUPPORTED_THEME/);
  });

  it("fails on a duplicate token name", () => {
    const data = snapshot();
    data.color.tokens.push({ name: "background", value: "#000000" });
    expect(errorOf(data)).toMatch(/^INVALID_TOKEN_NAME: color\/background/);
  });

  it("fails on a family it does not know instead of dropping it", () => {
    expect(errorOf({ ...snapshot(), motion: { tokens: [] } })).toBe("UNKNOWN_FAMILY: motion");
  });

  it("fails on a token name that is not valid in a custom property", () => {
    const data = snapshot();
    data.color.tokens.push({ name: "brand.dark", value: "#000000" });
    expect(errorOf(data)).toMatch(/^INVALID_TOKEN_NAME: color\/brand\.dark/);
  });

  it.each([
    ["shadow", "0 4px 12px rgba(10, 10, 10, 0.08"],
    ["shadow", "0 4px 12px 0)"],
  ])("fails on unbalanced parentheses in a %s value (%s)", (family, value) => {
    const data = snapshot();
    (data[family] as { tokens: Token[] }).tokens[0] = { name: "shadow-popover", value };
    expect(errorOf(data)).toMatch(/^UNSUPPORTED_VALUE: shadow\/shadow-popover/);
  });

  it("fails on an unpaired quote in a font family", () => {
    const data = snapshot();
    (data.type as { families: Record<string, string> }).families.sans = '"Inter, sans-serif';
    expect(errorOf(data)).toMatch(/^UNSUPPORTED_VALUE: type\/families\/sans/);
  });
});
