// Compile-time canaries: if `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes` are ever
// turned off, the directives below become unused and `pnpm typecheck` fails.
const items: { x: number }[] = [];
// @ts-expect-error noUncheckedIndexedAccess: items[0] may be undefined
export const first: number = items[0].x;

type Options = { label?: string };
// @ts-expect-error exactOptionalPropertyTypes: undefined is not assignable to an optional prop
export const options: Options = { label: undefined };
