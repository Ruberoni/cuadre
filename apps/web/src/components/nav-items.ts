import type { Role } from "@cuadre/contracts";

/** A sidebar item and the roles that see it (App shell handoff, #7 → "Nav per role"). */
export type NavItem<To extends string = string> = {
  to: To;
  label: string;
  roles: readonly Role[];
};

export type NavGroup<To extends string = string> = {
  id: string;
  label: string;
  items: readonly NavItem<To>[];
};

/** The items a role sees, in their order: the others are hidden, never disabled. */
export function visibleNavItems<Item extends NavItem>(items: readonly Item[], role: Role): Item[] {
  return items.filter((item) => item.roles.includes(role));
}

/** The sidebar groups a role sees; groups with no visible items are omitted. */
export function visibleNavGroups<To extends string>(
  groups: readonly NavGroup<To>[],
  role: Role,
): { id: string; label: string; items: NavItem<To>[] }[] {
  const result: { id: string; label: string; items: NavItem<To>[] }[] = [];
  for (const group of groups) {
    const items = visibleNavItems(group.items, role);
    if (items.length > 0) {
      result.push({ id: group.id, label: group.label, items });
    }
  }
  return result;
}
