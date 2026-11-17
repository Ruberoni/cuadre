// Stop hook (ADR-014): typecheck, Biome and unit tests of the touched packages, ~30 s budget.
//
// A failing check blocks the stop (exit 2) for up to MAX_ROUNDS consecutive stops; after that the
// hook lets the agent stop and tells it to escalate (AGENTS.md: three rounds, then explain).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUDGET_MS = 30_000;
const MAX_ROUNDS = 3;
const MAX_COMMAND_CHARS = 6_000; // cmd.exe limits a command line to 8191 characters
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // No JSON on stdin: run with defaults.
}

const sessionId = String(input.session_id ?? "local").replace(/[^\w-]/g, "_");
const roundsFile = join(tmpdir(), `cuadre-stop-rounds-${sessionId}.json`);
const readRounds = () => {
  try {
    return JSON.parse(readFileSync(roundsFile, "utf8")).rounds ?? 0;
  } catch {
    return 0;
  }
};
const clearRounds = () => rmSync(roundsFile, { force: true });

const git = (...args) =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout?.split("\n").filter(Boolean) ?? [];

const base = ["main", "origin/main"].find(
  (ref) => spawnSync("git", ["rev-parse", "--verify", "-q", ref], { cwd: root }).status === 0,
);
const mergeBase = base ? git("merge-base", "HEAD", base)[0] : undefined;
const touched = new Set([
  ...(mergeBase ? git("diff", "--name-only", mergeBase) : []),
  ...git("diff", "--name-only"),
  ...git("ls-files", "--others", "--exclude-standard"),
]);
if (touched.size === 0) {
  clearRounds();
  process.exit(0);
}

// Map every touched path to workspace packages, deleted files included: removing a file that
// something else still imports must still trigger typecheck. Other code files touch everything.
const packages = new Set();
let rootChange = false;
for (const f of touched) {
  const m = f.match(/^(apps|packages)\/([^/]+)\//);
  if (m) packages.add(`${m[1]}/${m[2]}`);
  else if (!f.startsWith("docs/") && !f.endsWith(".md")) rootChange = true;
}

const names = [...packages]
  .map((dir) => {
    try {
      return JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")).name;
    } catch {
      return undefined;
    }
  })
  .filter(Boolean);

const steps = [];

// Biome only sees files that still exist; the list is split to stay under the command-line limit.
const lintable = [...touched]
  .filter((f) => /\.(m?[jt]sx?|json|jsonc|css)$/.test(f) && existsSync(join(root, f)))
  .map((f) => JSON.stringify(f));
for (let chunk = [], size = 0, i = 0; i <= lintable.length; i++) {
  const next = lintable[i];
  if (next === undefined || size + next.length > MAX_COMMAND_CHARS) {
    if (chunk.length > 0) {
      steps.push(["biome", `exec biome check --no-errors-on-unmatched ${chunk.join(" ")}`]);
    }
    chunk = [];
    size = 0;
  }
  if (next !== undefined) {
    chunk.push(next);
    size += next.length + 1;
  }
}

if (names.length > 0 || rootChange) {
  const filter = rootChange ? [] : names.flatMap((n) => ["--filter", JSON.stringify(n)]);
  steps.push(["typecheck + unit tests", `exec turbo run typecheck test:unit ${filter.join(" ")}`]);
}

const deadline = Date.now() + BUDGET_MS;
const failures = [];

function run(label, args) {
  return new Promise((resolve) => {
    // One command string: with shell: true an args array is only concatenated (DEP0190).
    // Off Windows the child leads its own process group so a timeout can kill the whole tree.
    const detached = process.platform !== "win32";
    const child = spawn(`pnpm ${args}`, { cwd: root, shell: true, windowsHide: true, detached });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      out += d;
    });
    const timer = setTimeout(
      () => {
        if (detached) process.kill(-child.pid, "SIGKILL");
        else spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
        resolve({ label, timedOut: true, out });
      },
      Math.max(deadline - Date.now(), 1000),
    );
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ label, code, out });
    });
  });
}

for (const [label, args] of steps) {
  const result = await run(label, args);
  if (result.timedOut) {
    // Exit 0 does not show stderr to the agent; systemMessage is shown to the user instead.
    const message = `Stop checks exceeded ${BUDGET_MS / 1000}s during "${label}" and were skipped. Run them by hand before opening a PR.`;
    process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
    process.exit(0);
  }
  if (result.code !== 0) failures.push(`## ${label} failed\n${result.out.slice(-3000)}`);
}

if (failures.length === 0) {
  clearRounds();
  process.exit(0);
}

const rounds = readRounds() + 1;
if (rounds > MAX_ROUNDS) {
  clearRounds();
  const message = `Stop checks still fail after ${MAX_ROUNDS} rounds. Stop fixing and explain in the issue or PR which check fails and why you think it does (AGENTS.md).`;
  process.stdout.write(`${JSON.stringify({ systemMessage: message })}\n`);
  process.stderr.write(`${message}\n\n${failures.join("\n\n")}\n`);
  process.exit(0);
}
writeFileSync(roundsFile, JSON.stringify({ rounds }));
process.stderr.write(`Round ${rounds}/${MAX_ROUNDS}\n\n${failures.join("\n\n")}\n`);
process.exit(2);
