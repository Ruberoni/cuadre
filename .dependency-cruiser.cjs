/** Module boundaries (ADR-001). Run with `pnpm lint:boundaries`; the module rules are anchored to apps/api, the UI rule to apps/web, the purity rule to packages/shared-kernel; proven by apps/api/test/boundaries.test.ts, apps/web/test/boundaries.test.ts and packages/shared-kernel/test/boundaries.test.ts. */

const IO_CORE_MODULES =
  "^(node:)?(fs|fs/promises|net|http|https|http2|dgram|dns|child_process|cluster|worker_threads|tls)$";

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const forbidden = [
  {
    name: "module-public-api",
    comment:
      "A module may import another module only through its index.ts (ADR-001). Never reach into its domain, application, infrastructure or http.",
    severity: "error",
    // The fixtures prefix is a non-capturing group: an unmatched capture group disappears from the
    // match, which shifted `$2` away and made every import inside a real module a violation.
    from: { path: "^apps/api/(?:test/boundaries-fixtures/)?src/modules/([^/]+)/" },
    to: {
      path: "(^|/)src/modules/[^/]+/",
      pathNot: ["(^|/)src/modules/$1/", "(^|/)src/modules/[^/]+/index[.]ts$"],
    },
  },
  {
    name: "outside-uses-module-public-api",
    comment:
      "Code outside src/modules (app wiring, db, server) may import a module only through its index.ts.",
    severity: "error",
    from: { path: "^apps/api/(test/boundaries-fixtures/)?src/(?!modules/)" },
    to: {
      path: "(^|/)src/modules/[^/]+/",
      pathNot: "(^|/)src/modules/[^/]+/index[.]ts$",
    },
  },
  {
    name: "domain-purity",
    comment:
      "domain/ is pure: it never imports infrastructure/, http/, the db layer, Drizzle, Hono or any I/O (ADR-001).",
    severity: "error",
    from: { path: "^apps/api/(test/boundaries-fixtures/)?src/modules/[^/]+/domain/" },
    to: {
      path: [
        "(^|/)src/modules/[^/]+/(infrastructure|http)/",
        "(^|/)src/db/",
        "node_modules/(drizzle-orm|drizzle-kit|hono|@hono|postgres)/",
      ],
    },
  },
  {
    name: "domain-no-io-core-modules",
    comment: "domain/ never imports Node I/O modules.",
    severity: "error",
    from: { path: "^apps/api/(test/boundaries-fixtures/)?src/modules/[^/]+/domain/" },
    to: { dependencyTypes: ["core"], path: IO_CORE_MODULES },
  },
  {
    name: "ui-primitives-stay-generic",
    comment:
      "Design-system primitives (apps/web components/ui, lib, hooks, styles) never import screens or feature code (ADR-015).",
    severity: "error",
    from: { path: "^apps/web/(test/boundaries-fixtures/)?src/(components/ui|lib|hooks|styles)/" },
    to: {
      path: "^apps/web/(test/boundaries-fixtures/)?src/",
      pathNot: "^apps/web/(test/boundaries-fixtures/)?src/(components/ui|lib|hooks|styles)/",
    },
  },
  {
    name: "shared-kernel-purity",
    comment:
      "packages/shared-kernel is pure domain code shared by apps/api domains and apps/web: its code imports nothing outside the package (no npm packages, no Node core, no apps). Test files are exempt (vitest, fast-check).",
    severity: "error",
    from: {
      path: "^packages/shared-kernel/(test/boundaries-fixtures/)?src/",
      pathNot: "[.]test[.]ts$",
    },
    to: { pathNot: "^packages/shared-kernel/(test/boundaries-fixtures/)?src/" },
  },
  {
    name: "no-circular",
    severity: "error",
    from: {},
    to: { circular: true },
  },
  {
    name: "not-to-unresolvable",
    severity: "error",
    from: {},
    to: { couldNotResolve: true },
  },
];

/** @type {import('dependency-cruiser').IOptions} */
const options = {
  doNotFollow: { path: "node_modules" },
  exclude: { path: "boundaries-fixtures" },
  tsPreCompilationDeps: true,
  tsConfig: { fileName: "tsconfig.depcruise.json" },
  enhancedResolveOptions: {
    exportsFields: ["exports"],
    conditionNames: ["import", "require", "node", "default", "types"],
    mainFields: ["module", "main", "types", "typings"],
  },
};

module.exports = { forbidden, options };
