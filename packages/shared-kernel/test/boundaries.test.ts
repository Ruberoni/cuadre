import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cruise, type ICruiseOptions } from "dependency-cruiser";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const config = require("../../../.dependency-cruiser.cjs") as {
  forbidden: NonNullable<NonNullable<ICruiseOptions["ruleSet"]>["forbidden"]>;
  options: ICruiseOptions;
};

// Readable, install-independent names: `imports-npm.ts` for fixtures, `fast-check` for packages.
function short(path: string): string {
  const pkg = path.match(/.*node_modules[/]((?:@[^/]+[/])?[^/]+)[/]/);
  return pkg?.[1] ?? path.split("boundaries-fixtures/src/")[1] ?? path;
}

// Proof that the purity rule still bites: it must reject these fixture files, so it cannot
// silently stop working. The fixtures are excluded from `pnpm lint`.
describe("shared-kernel purity rule", () => {
  it("reports exactly the expected violations on the fixtures", async () => {
    const previousCwd = process.cwd();
    process.chdir(repoRoot);
    try {
      const result = await cruise(["packages/shared-kernel/test/boundaries-fixtures/src"], {
        ...config.options,
        // Override the default exclude (which hides the fixtures) without hiding node_modules.
        exclude: { path: "(^|/).git/" },
        ruleSet: { forbidden: config.forbidden },
        validate: true,
      });
      const output = result.output as {
        summary: { violations: { rule: { name: string }; from: string; to: string }[] };
      };
      const violations = output.summary.violations
        .map((v) => `${v.rule.name} | ${short(v.from)} -> ${short(v.to)}`)
        .sort();

      // Not listed on purpose: imports-vitest.test.ts (test files may import tools) and
      // imports-within-package.ts (importing inside the package is fine).
      expect(violations).toEqual([
        "shared-kernel-purity | imports-app.ts -> apps/api/src/shared/clamp.ts",
        "shared-kernel-purity | imports-node-core.ts -> fs",
        "shared-kernel-purity | imports-npm.ts -> fast-check",
      ]);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
