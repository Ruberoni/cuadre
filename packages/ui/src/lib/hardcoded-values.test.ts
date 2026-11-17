import { describe, expect, it } from "vitest";
import { findHardcodedValues } from "./hardcoded-values.ts";

const matches = (source: string) => findHardcodedValues(source).map((found) => found.match);

describe("findHardcodedValues", () => {
  it("flags hex colors, also inside arbitrary values", () => {
    expect(matches('const a = "#0f6674"; const b = "bg-[#fff]";')).toEqual(["#0f6674", "#fff"]);
  });

  it("flags color functions", () => {
    expect(matches("color: rgba(10, 10, 10, 0.5); fill: oklch(0.5 0 0)")).toEqual([
      "rgba(",
      "oklch(",
    ]);
  });

  it("flags Tailwind's default palette, which tokens.css resets", () => {
    expect(matches("bg-black/50 text-white border-red-500")).toEqual([
      "bg-black",
      "text-white",
      "border-red-500",
    ]);
  });

  it("allows semantic token classes", () => {
    expect(matches("bg-primary text-primary-foreground hover:bg-primary-hover bg-overlay")).toEqual(
      [],
    );
  });

  it("does not take anchors for colors", () => {
    expect(matches('<a href="#add">Agregar</a> <a href="#fab">x</a>')).toEqual([]);
  });

  it("reports the line number", () => {
    expect(findHardcodedValues("ok\n\nconst x = '#abcdef';")[0]?.line).toBe(3);
  });
});
