import type { Role } from "@cuadre/contracts";

/** A sidebar item and the roles that see it (App shell handoff, #7 → "Nav per role"). */
export type NavItem<To extends string = string> = {
  to: To;
  label: string;
  roles: readonly Role[];
};

/** The items a role sees, in their order: the others are hidden, never disabled. */
export function visibleNavItems<Item extends NavItem>(items: readonly Item[], role: Role): Item[] {
  return items.filter((item) => item.roles.includes(role));
}
