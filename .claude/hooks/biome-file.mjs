// PostToolUse hook: format and lint the file Claude just edited (ADR-014: cheap checks first).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const file = input.tool_input?.file_path;
if (typeof file !== "string") process.exit(0);

const command = `pnpm exec biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${JSON.stringify(file)}`;
const result = spawnSync(command, {
  cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
  encoding: "utf8",
  shell: true,
});

if (result.status !== 0) {
  process.stderr.write(`Biome found problems in ${file}:\n${result.stdout}${result.stderr}`);
  process.exit(2);
}
