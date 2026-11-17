declare const brand: unique symbol;

/** Type-only tag: a plain object cannot be passed where a validated value is expected. */
export type Brand<Name extends string> = { readonly [brand]: Name };
