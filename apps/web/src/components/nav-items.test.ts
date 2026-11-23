import { describe, expect, it } from "vitest";
import { type NavGroup, visibleNavGroups, visibleNavItems } from "./nav-items.ts";

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

describe("visibleNavGroups", () => {
  const groups: readonly NavGroup[] = [
    {
      id: "general",
      label: "General",
      items: [
        {
          to: "/productos",
          label: "Productos",
          roles: ["admin", "sales", "purchasing", "warehouse"],
        },
      ],
    },
    {
      id: "purchasing",
      label: "Compras",
      items: [{ to: "/proveedores", label: "Proveedores", roles: ["admin", "purchasing"] }],
    },
  ];

  it("shows Compras group to admin and purchasing", () => {
    expect(visibleNavGroups(groups, "admin").map((g) => g.label)).toEqual(["General", "Compras"]);
    expect(visibleNavGroups(groups, "purchasing").map((g) => g.label)).toEqual([
      "General",
      "Compras",
    ]);
  });

  it("omits empty groups for roles that cannot access any item in them", () => {
    expect(visibleNavGroups(groups, "sales").map((g) => g.label)).toEqual(["General"]);
    expect(visibleNavGroups(groups, "warehouse").map((g) => g.label)).toEqual(["General"]);
  });
});
