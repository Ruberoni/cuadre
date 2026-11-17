// Node-only helper for tests: scans a package's `src` for hand-written token values.
// Each package runs it over its own src (see no-hardcoded-tokens.test.ts), so Turborepo's cache
// can never hide a violation behind another package's hash.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { findHardcodedValues } from "./hardcoded-values.ts";

// tokens.css is where token values live; tests quote examples; routeTree.gen.ts is generated.
const SKIP = /(?:^|[\\/])(?:tokens\.css|routeTree\.gen\.ts)$|\.test\.tsx?$/;

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(?:tsx?|css)$/.test(entry.name) && !SKIP.test(path)) yield path;
  }
}

/** One line per violation: `file:line match (reason)`. Empty when the source is clean. */
export function scanForHardcodedValues(srcDir: string): string[] {
  return [...sourceFiles(srcDir)].flatMap((file) =>
    findHardcodedValues(readFileSync(file, "utf8")).map(
      (found) => `${relative(srcDir, file)}:${found.line} ${found.match} (${found.reason})`,
    ),
  );
}
