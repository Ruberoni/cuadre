// PreToolUse hook (AGENTS.md → Workflow): block `git push` and `gh pr create` from a branch whose
// name is not `<type>/<issue>-<slug>` with a Conventional Commits type. Sessions start on a
// generated name (`claude/<random>`); rename it with `git branch -m` before the first push.
//
// Only unpublished branches are checked: a branch that already has its twin on the remote has
// been published under its name, and renaming it would close its PR.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TYPES = "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert";
// `feat/5-design-tokens-formatting`: type, optional issue number, lowercase kebab-case slug.
const BRANCH = new RegExp(`^(?:${TYPES})/(?:\\d+-)?[a-z0-9]+(?:-[a-z0-9]+)*$`);
// `git push`, also with options before the subcommand (`git -C dir push`), and `gh pr create`.
const PUBLISHES =
  /(?:^|[\s;&|(])(?:git(?:\s+(?:-[Cc]\s+\S+|-\S+))*\s+push|gh\s+pr\s+create)(?:\s|$)/;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const command = input.tool_input?.command;
if (typeof command !== "string" || !PUBLISHES.test(command)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
const git = (...args) =>
  spawnSync("git", args, { cwd: root, encoding: "utf8" }).stdout?.trim() ?? "";

const branch = git("branch", "--show-current");
// Detached HEAD, or `main` itself (protected; pushing it is not this hook's business).
if (!branch || branch === "main" || BRANCH.test(branch)) process.exit(0);

// `origin/<branch>` as upstream means it is already published. A branch cut from `origin/main`
// tracks `origin/main`, which does not count.
const upstream = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
if (upstream.slice(upstream.indexOf("/") + 1) === branch) process.exit(0);

process.stderr.write(
  [
    `Branch "${branch}" does not follow the naming convention: <type>/<issue>-<slug>.`,
    `Types: ${TYPES.replaceAll("|", ", ")}. Slug in lowercase kebab-case; the issue number is optional`,
    "(e.g. feat/5-design-tokens-formatting, chore/sync-design-system-2026-11-17).",
    "Rename it before publishing, using the Conventional Commit type the PR title will carry:",
    "  git branch -m <type>/<issue>-<slug>",
    "",
  ].join("\n"),
);
process.exit(2);
