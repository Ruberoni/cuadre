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

// Readable, install-independent names: `a/domain/x.ts` for modules, `drizzle-orm` for packages.
function short(path: string): string {
  const pkg = path.match(/.*node_modules[/]((?:@[^/]+[/])?[^/]+)[/]/);
  return pkg?.[1] ?? path.split("src/modules/")[1] ?? path;
}

// Proof that the boundary rules still bite: they must reject these fixture files, so the rules
// cannot silently stop working. The fixtures are excluded from `pnpm lint`.
describe("module boundary rules", () => {
  it("reports exactly the expected violations on the fixture modules", async () => {
    const previousCwd = process.cwd();
    process.chdir(repoRoot);
    try {
      const result = await cruise(["apps/api/test/boundaries-fixtures/src"], {
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

      expect(violations).toEqual([
        "domain-purity | a/domain/imports-drizzle.ts -> drizzle-orm",
        "domain-purity | a/domain/imports-infrastructure.ts -> a/infrastructure/repository.ts",
        "module-public-api | a/application/reaches-into-b.ts -> b/application/secret.ts",
      ]);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
