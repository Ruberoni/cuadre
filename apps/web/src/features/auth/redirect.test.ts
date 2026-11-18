import { describe, expect, it } from "vitest";
import { HOME_PATH, safeRedirect } from "./redirect.ts";

const ORIGIN = "http://127.0.0.1:4173";

describe("safeRedirect", () => {
  it("keeps a same-origin path with its search and hash", () => {
    expect(safeRedirect("/productos?q=harina&page=2#x", ORIGIN)).toBe(
      "/productos?q=harina&page=2#x",
    );
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["another origin", "https://evil.example/productos"],
    ["protocol-relative", "//evil.example/productos"],
    ["backslash trick", "/\\evil.example"],
    ["control character trick", "/\t/evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["relative without a slash", "productos"],
    ["the Login page itself", "/login?redirect=/productos"],
    ["the Login page without search", "/login"],
  ])("falls back to Productos for %s", (_case, value) => {
    expect(safeRedirect(value, ORIGIN)).toBe(HOME_PATH);
  });
});
