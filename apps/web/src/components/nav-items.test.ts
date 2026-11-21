import { describe, expect, it } from "vitest";
import { visibleNavItems } from "./nav-items.ts";

const items = [
  { to: "/a", label: "Para todos", roles: ["admin", "sales", "purchasing", "warehouse"] },
  { to: "/b", label: "Solo admin", roles: ["admin"] },
  { to: "/c", label: "Ventas y admin", roles: ["admin", "sales"] },
] as const;

describe("visibleNavItems", () => {
  it("shows an admin every item, in order", () => {
    expect(visibleNavItems(items, "admin").map((item) => item.label)).toEqual([
      "Para todos",
      "Solo admin",
      "Ventas y admin",
    ]);
  });

  it("hides from a role the items it may not use, keeping the order", () => {
    expect(visibleNavItems(items, "sales").map((item) => item.label)).toEqual([
      "Para todos",
      "Ventas y admin",
    ]);
    expect(visibleNavItems(items, "warehouse").map((item) => item.label)).toEqual(["Para todos"]);
  });
});
