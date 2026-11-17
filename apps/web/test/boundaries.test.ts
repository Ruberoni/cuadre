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

// Proof that the primitives rule still bites: it must reject the fixture that reaches into a
// screen and accept the ones that do not, so it cannot silently stop working (ADR-015).
// The fixtures are excluded from `pnpm lint`, Biome and tsc.
describe("UI primitives boundary rule", () => {
  it("reports exactly the expected violations on the fixture sources", async () => {
    const previousCwd = process.cwd();
    process.chdir(repoRoot);
    try {
      const result = await cruise(["apps/web/test/boundaries-fixtures/src"], {
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
        .map((v) => `${v.rule.name} | ${v.from.split("src/")[1]} -> ${v.to.split("src/")[1]}`)
        .sort();

      expect(violations).toEqual([
        "ui-primitives-stay-generic | components/ui/reaches-into-routes-via-alias.ts -> routes/__root.tsx",
        "ui-primitives-stay-generic | components/ui/reaches-into-routes.ts -> routes/page.ts",
      ]);
    } finally {
      process.chdir(previousCwd);
    }
  });
});
