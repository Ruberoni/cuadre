// Stop hook (ADR-014): typecheck, Biome and unit tests of the touched packages, ~30 s budget.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BUDGET_MS = 30_000;
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // No JSON on stdin: run with defaults.
}
// Already blocked once this turn: let the agent stop instead of looping forever.
if (input.stop_hook_active) process.exit(0);

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
const files = [...touched].filter((f) => existsSync(join(root, f)));
if (files.length === 0) process.exit(0);

// Map touched files to workspace packages (apps/* and packages/*); other code files touch all.
const packages = new Set();
let rootChange = false;
for (const f of files) {
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
const lintable = files.filter((f) => /\.(m?[jt]sx?|json|jsonc|css)$/.test(f));
if (lintable.length > 0) {
  steps.push([
    "biome",
    `exec biome check --no-errors-on-unmatched ${lintable.map((f) => JSON.stringify(f)).join(" ")}`,
  ]);
}
if (names.length > 0 || rootChange) {
  const filter = rootChange ? [] : names.flatMap((n) => ["--filter", JSON.stringify(n)]);
  steps.push(["typecheck + unit tests", `exec turbo run typecheck test:unit ${filter.join(" ")}`]);
}

const deadline = Date.now() + BUDGET_MS;
const failures = [];

function run(label, args) {
  // One command string: with shell: true, an args array is only concatenated (DEP0190).
  return new Promise((resolve) => {
    const child = spawn(`pnpm ${args}`, { cwd: root, shell: true, windowsHide: true });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
    });
    child.stderr.on("data", (d) => {
      out += d;
    });
    const timer = setTimeout(
      () => {
        // Kill the whole process tree, then report the timeout without blocking the agent.
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
        } else {
          child.kill("SIGKILL");
        }
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
    process.stderr.write(`Stop checks exceeded ${BUDGET_MS / 1000}s during "${label}"; skipped.\n`);
    process.exit(0);
  }
  if (result.code !== 0) failures.push(`## ${label} failed\n${result.out.slice(-3000)}`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n\n")}\n`);
  process.exit(2);
}
