/** Module boundaries (ADR-001). Run with `pnpm lint:boundaries`; proven by apps/api/test/boundaries.test.ts. */

const IO_CORE_MODULES =
  "^(node:)?(fs|fs/promises|net|http|https|http2|dgram|dns|child_process|cluster|worker_threads|tls)$";

/** @type {import('dependency-cruiser').IForbiddenRuleType[]} */
const forbidden = [
  {
    name: "module-public-api",
    comment:
      "A module may import another module only through its index.ts (ADR-001). Never reach into its domain, application, infrastructure or http.",
    severity: "error",
    from: { path: "(^|/)src/modules/([^/]+)/" },
    to: {
      path: "(^|/)src/modules/[^/]+/",
      pathNot: ["(^|/)src/modules/$2/", "(^|/)src/modules/[^/]+/index.ts$"],
    },
  },
  {
    name: "outside-uses-module-public-api",
    comment:
      "Code outside src/modules (app wiring, db, server) may import a module only through its index.ts.",
    severity: "error",
    from: { path: "(^|/)src/(?!modules/)" },
    to: {
      path: "(^|/)src/modules/[^/]+/",
      pathNot: "(^|/)src/modules/[^/]+/index.ts$",
    },
  },
  {
    name: "domain-purity",
    comment:
      "domain/ is pure: it never imports infrastructure/, http/, the db layer, Drizzle, Hono or any I/O (ADR-001).",
    severity: "error",
    from: { path: "(^|/)src/modules/[^/]+/domain/" },
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
    from: { path: "(^|/)src/modules/[^/]+/domain/" },
    to: { dependencyTypes: ["core"], path: IO_CORE_MODULES },
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
  enhancedResolveOptions: {
    exportsFields: ["exports"],
    conditionNames: ["import", "require", "node", "default", "types"],
    mainFields: ["module", "main", "types", "typings"],
  },
};

module.exports = { forbidden, options };
