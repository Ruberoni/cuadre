// PostToolUse hook: format and lint the file the agent just edited (ADR-014: cheap checks first).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function resolveRoot(input) {
  if (typeof input.cwd === "string" && input.cwd.length > 0) return input.cwd;
  if (Array.isArray(input.workspacePaths) && typeof input.workspacePaths[0] === "string") {
    return input.workspacePaths[0];
  }
  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).stdout?.trim();
  return top || process.cwd();
}

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  emit({});
  process.exit(0);
}

const file = input.toolCall?.args?.Path;
if (typeof file !== "string" || file.length === 0) {
  emit({});
  process.exit(0);
}

const root = resolveRoot(input);
// Files outside the repo (artifacts, scratchpad) are not ours to lint; Biome panics on them.
const rel = relative(root, resolve(root, file));
if (rel.startsWith("..") || isAbsolute(rel)) {
  emit({});
  process.exit(0);
}

const command = `pnpm exec biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${JSON.stringify(file)}`;
const result = spawnSync(command, { cwd: root, encoding: "utf8", shell: true });

if (result.status !== 0) {
  process.stderr.write(`Biome found problems in ${file}:\n${result.stdout}${result.stderr}`);
}

emit({});
