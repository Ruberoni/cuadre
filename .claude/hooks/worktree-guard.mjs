// PreToolUse hook (Bash and PowerShell): in a worktree session, block writing commands that would run
// outside the worktree. `cd ../.. && pnpm --filter @cuadre/api add x` from a worktree under
// `.claude/worktrees/` lands in the main checkout and changes its package.json and lockfile.
//
// The command's directory is followed through `cd` / `Set-Location` / `pushd` segments and
// `git -C`, `pnpm -C|--dir`, `npm --prefix`. Read-only commands always pass; a directory that
// cannot be resolved statically (`cd $DIR`, `cd -`) passes too. No-op in the main checkout.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GIT_WRITES = new Set([
  "add",
  "am",
  "checkout",
  "cherry-pick",
  "clean",
  "commit",
  "merge",
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
  "i",
  "install",
  "remove",
  "rm",
  "uninstall",
  "un",
  "update",
  "up",
  "upgrade",
  "db:generate",
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
const CD = new Set(["cd", "chdir", "pushd", "set-location", "sl", "push-location"]);

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

/** Simple commands of a shell line (separators and parentheses dropped). */
export function segments(command) {
  const result = [[]];
  for (const word of tokenize(command)) {
    if (";&|()".includes(word) && word.length === 1) {
      if (result.at(-1).length > 0) result.push([]);
    } else {
      result.at(-1).push(word);
    }
  }
  return result.filter((s) => s.length > 0);
}

/** Git Bash writes Windows drives as `/c/...`; `~` is the home directory. */
function toPath(word, cwd) {
  if (word === "~" || word.startsWith("~/")) return resolve(homedir(), word.slice(2));
  const drive = process.platform === "win32" && word.match(/^\/([a-zA-Z])(\/.*)?$/);
  if (drive) return resolve(`${drive[1]}:/`, (drive[2] ?? "/").slice(1));
  return resolve(cwd, word);
}

const unresolvable = (word) => word === undefined || word === "-" || /[$`%*]/.test(word);

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

/**
 * Where each writing command of `command` would run, starting from `cwd`. Returns one entry per
 * writing command: `{ command, dir }`, with `dir` undefined when it cannot be resolved.
 */
export function writingCommands(command, cwd) {
  const found = [];
  let dir = cwd;
  for (const words of segments(command)) {
    const start = words.findIndex((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
    if (start === -1) continue;
    const program = words[start].toLowerCase().replace(/\.(exe|cmd)$/, "");
    const text = words.join(" ");

    if (CD.has(program)) {
      const args = words.slice(start + 1).filter((w) => !/^-(Path|LiteralPath)$/i.test(w));
      const target = args[0] ?? "~";
      dir = dir === undefined || unresolvable(target) ? undefined : toPath(target, dir);
      continue;
    }

    let here = dir;
    let writes = false;
    if (program === "git") {
      const { dirs, subcommand } = scan(words, start + 1, ["-C"], ["-c", "--git-dir"]);
      for (const d of dirs)
        here = here === undefined || unresolvable(d) ? undefined : toPath(d, here);
      writes = GIT_WRITES.has(subcommand);
    } else if (program === "pnpm") {
      const { dirs, subcommand, rest } = scan(
        words,
        start + 1,
        ["-C", "--dir"],
        ["--filter", "-F", "--reporter", "--loglevel"],
      );
      for (const d of dirs)
        here = here === undefined || unresolvable(d) ? undefined : toPath(d, here);
      writes = PNPM_WRITES.has(subcommand) || /\bdb:generate\b/.test(rest.join(" "));
    } else if (program === "npm") {
      const { dirs, subcommand } = scan(words, start + 1, ["--prefix"], []);
      for (const d of dirs)
        here = here === undefined || unresolvable(d) ? undefined : toPath(d, here);
      writes = NPM_WRITES.has(subcommand);
    }
    if (/\bdrizzle-kit\s+generate\b/.test(text)) writes = true;
    if (writes) found.push({ command: text, dir: here });
  }
  return found;
}

/** True when `dir` is `root` or inside it (case-insensitively on Windows). */
export function isInside(root, dir) {
  const fold = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
  const rel = relative(fold(resolve(root)), fold(resolve(dir)));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
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
  const root = worktreeRoot(project);
  if (!root) process.exit(0);

  const message = check(command, input.cwd ?? project, root);
  if (message) {
    process.stderr.write(message);
    process.exit(2);
  }
}
