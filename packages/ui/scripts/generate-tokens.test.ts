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

  it("maps shadcn's --radius to radius-md and keeps the three radii", () => {
    const css = generate(snapshot());
    expect(css).toContain("--radius: 6px;");
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

  it("fails without radius-md", () => {
    const data = snapshot();
    data.radius.tokens = data.radius.tokens.filter((token) => token.name !== "radius-md");
    expect(errorOf(data)).toMatch(/^INVALID_SNAPSHOT: radius-md/);
  });
});
