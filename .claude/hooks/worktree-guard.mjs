// PreToolUse hook (Bash and PowerShell): in a worktree session, block writing commands that would run
// outside the worktree. `cd ../.. && pnpm --filter @cuadre/api add x` from a worktree under
// `.claude/worktrees/` lands in the main checkout and changes its package.json and lockfile.
//
// The command's directory is followed through `cd` / `Set-Location` / `pushd` / `popd`, subshells
// `( … )`, `git -C|--work-tree`, `pnpm -C|--dir`, `npm --prefix`, and into `bash -c '…'`. Read-only
// commands always pass; a directory that cannot be resolved statically (`cd $DIR`, `cd -`) passes
// too. No-op in the main checkout. A best-effort guard, not a sandbox: scripts that `cd` on their
// own are not followed.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const GIT_WRITES = new Set([
  "add",
  "am",
  "apply",
  "checkout",
  "cherry-pick",
  "clean",
  "commit",
  "merge",
  "mv",
  "pull",
  "push",
  "rebase",
  "reset",
  "restore",
  "revert",
  "rm",
  "stash",
  "switch",
]);
const PNPM_WRITES = new Set([
  "add",
  "dlx",
  "format",
  "i",
  "install",
  "remove",
  "rm",
  "uninstall",
  "un",
  "update",
  "up",
  "upgrade",
]);
const NPM_WRITES = new Set([
  "ci",
  "i",
  "install",
  "uninstall",
  "remove",
  "rm",
  "un",
  "update",
  "up",
]);
// Scripts and tools that write files wherever they run, through any runner.
const WRITING_SCRIPT = /\b(db:generate|tokens:generate|drizzle-kit\s+generate)\b|\s--write\b/;
const CD = new Set(["cd", "chdir", "pushd", "set-location", "sl", "push-location"]);
const POPD = new Set(["popd", "pop-location"]);
const SHELLS = new Set(["bash", "sh", "pwsh", "powershell"]);
const PREFIXES = new Set(["env", "command", "exec", "time", "nohup"]);

/** Splits a shell line into words, honouring quotes; operators come out as their own words. */
export function tokenize(command) {
  const words = [];
  let word = "";
  let quote = "";
  let inWord = false;
  const flush = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = "";
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      inWord = true;
    } else if (/\s/.test(c) && c !== "\n") {
      flush();
    } else if ("\n;&|()".includes(c)) {
      flush();
      words.push(c === "\n" ? ";" : c);
    } else {
      word += c;
      inWord = true;
    }
  }
  flush();
  return words;
}

const OPERATORS = new Set([";", "&", "|", "(", ")"]);

/** Simple commands of a shell line, with `(` and `)` kept as their own entries. */
export function segments(command) {
  const result = [];
  let current = [];
  const end = () => {
    if (current.length > 0) result.push(current);
    current = [];
  };
  for (const word of tokenize(command)) {
    if (!OPERATORS.has(word)) {
      current.push(word);
      continue;
    }
    end();
    if (word === "(" || word === ")") result.push(word);
  }
  end();
  return result;
}

/** Git Bash writes Windows drives as `/c/...`; `~` is the home directory. */
function toPath(word, cwd) {
  if (word === "~" || word.startsWith("~/")) return resolve(homedir(), word.slice(2));
  const drive = process.platform === "win32" && word.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (drive) return resolve(`${drive[1]}:/`, (drive[2] ?? "/").slice(1));
  return resolve(cwd, word);
}

const unresolvable = (word) => word === undefined || word === "-" || /[$`%*]/.test(word);
const move = (dir, to) => (dir === undefined || unresolvable(to) ? undefined : toPath(to, dir));

/** Reads `<flag> <value>` / `<flag>=<value>` options before the subcommand. */
function scan(words, start, dirFlags, valueFlags) {
  const dirs = [];
  let i = start;
  while (i < words.length && words[i].startsWith("-")) {
    const [flag, inline] = words[i].split(/=(.*)/s);
    if (dirFlags.includes(flag)) {
      dirs.push(inline ?? words[++i]);
    } else if (valueFlags.includes(flag) && inline === undefined) {
      i++;
    }
    i++;
  }
  return { dirs, subcommand: words[i], rest: words.slice(i + 1) };
}

/** `git branch` writes when it renames, copies, deletes or creates; listing is read-only. */
function branchWrites(args) {
  if (args.some((a) => a === "--list" || a === "-l" || a === "--show-current")) return false;
  return args.some(
    (a) => /^(-[mMcCdDf]+|--(move|copy|delete|force))$/.test(a) || !a.startsWith("-"),
  );
}

/** Index of the program word, past `VAR=x` assignments and `env` / `command` prefixes. */
function programIndex(words) {
  let i = 0;
  while (i < words.length) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) i++;
    else if (PREFIXES.has(words[i]) || (words[i - 1] === "env" && words[i].startsWith("-"))) i++;
    else return i;
  }
  return -1;
}

/**
 * Where each writing command of `command` would run, starting from `cwd`. Returns one entry per
 * writing command: `{ command, dir }`, with `dir` undefined when it cannot be resolved.
 */
export function writingCommands(command, cwd) {
  const found = [];
  let dir = cwd;
  const subshells = [];
  const pushed = [];
  for (const entry of segments(command)) {
    if (entry === "(") {
      subshells.push(dir);
      continue;
    }
    if (entry === ")") {
      if (subshells.length > 0) dir = subshells.pop();
      continue;
    }
    const words = entry;
    const start = programIndex(words);
    if (start === -1) continue;
    const program = words[start].toLowerCase().replace(/\.(exe|cmd)$/, "");
    const args = words.slice(start + 1);
    const text = words.join(" ");

    if (CD.has(program)) {
      // Flags (`cd -P`, `Set-Location -Path`) are not the target; a lone `-` is (unresolvable).
      const target = args.find((w) => w === "-" || !w.startsWith("-")) ?? "~";
      if (program === "pushd" || program === "push-location") pushed.push(dir);
      dir = move(dir, target);
      continue;
    }
    if (POPD.has(program)) {
      dir = pushed.length > 0 ? pushed.pop() : undefined;
      continue;
    }
    if (SHELLS.has(program)) {
      const flag = args.findIndex((a) => /^-(c|command)$/i.test(a));
      if (flag !== -1 && args[flag + 1] !== undefined) {
        found.push(...writingCommands(args[flag + 1], dir));
      }
      continue;
    }

    let here = dir;
    let writes = WRITING_SCRIPT.test(text);
    if (program === "git") {
      const { dirs, subcommand, rest } = scan(
        words,
        start + 1,
        ["-C", "--work-tree"],
        ["-c", "--git-dir"],
      );
      for (const d of dirs) here = move(here, d);
      writes ||= GIT_WRITES.has(subcommand) || (subcommand === "branch" && branchWrites(rest));
    } else if (program === "pnpm") {
      const { dirs, subcommand } = scan(
        words,
        start + 1,
        ["-C", "--dir"],
        ["--filter", "-F", "--reporter", "--loglevel"],
      );
      for (const d of dirs) here = move(here, d);
      writes ||= PNPM_WRITES.has(subcommand);
    } else if (program === "npm") {
      const { dirs, subcommand } = scan(words, start + 1, ["--prefix"], []);
      for (const d of dirs) here = move(here, d);
      writes ||= NPM_WRITES.has(subcommand);
    }
    if (writes) found.push({ command: text, dir: here });
  }
  return found;
}

/** True when `dir` is `root` or inside it (case-insensitively on Windows). */
export function isInside(root, dir) {
  const fold = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
  const rel = relative(fold(resolve(root)), fold(resolve(dir)));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** The worktree root when `dir` belongs to a linked worktree, otherwise undefined. */
export function worktreeRoot(dir) {
  const out = spawnSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-dir", "--git-common-dir"],
    { cwd: dir, encoding: "utf8" },
  );
  if (out.status !== 0) return undefined;
  const [top, gitDir, commonDir] = out.stdout.trim().split(/\r?\n/);
  return gitDir && commonDir && resolve(gitDir) !== resolve(commonDir) ? top : undefined;
}

/** The message to block with, or undefined when the command may run. */
export function check(command, cwd, root) {
  const outside = writingCommands(command, cwd).filter(
    (c) => c.dir !== undefined && !isInside(root, c.dir),
  );
  if (outside.length === 0) return undefined;
  return [
    "Blocked: this session works in a git worktree, but this writing command would run outside it:",
    ...outside.map((c) => `  ${c.command}   (in ${c.dir})`),
    `Worktree root: ${root}`,
    "Run it inside the worktree: use absolute paths under the worktree root (e.g. `pnpm --dir <root>/apps/api add x`, `git -C <root> ...`) and never `cd` above it.",
    "",
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }
  const command = input.tool_input?.command;
  if (typeof command !== "string") process.exit(0);

  // The project dir is the worktree the session was started in; the shell's cwd may have drifted.
  const project = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
  const cwd = input.cwd ?? project;
  // Cheap first: most commands write nothing, and those never need git.
  if (writingCommands(command, cwd).length === 0) process.exit(0);
  const root = worktreeRoot(project);
  if (!root) process.exit(0);

  const message = check(command, cwd, root);
  if (message) {
    process.stderr.write(message);
    process.exit(2);
  }
}
