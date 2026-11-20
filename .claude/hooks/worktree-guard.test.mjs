// Run with `pnpm test:hooks` (part of `pnpm test:unit`).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { check, isInside, segments, worktreeRoot, writingCommands } from "./worktree-guard.mjs";

const root = resolve("/repo/.claude/worktrees/wt");
const main = resolve("/repo");

describe("segments", () => {
  it("splits on shell separators, keeps quoted words whole and marks subshells", () => {
    assert.deepEqual(segments("(cd .. && git status); ls"), [
      "(",
      ["cd", ".."],
      ["git", "status"],
      ")",
      ["ls"],
    ]);
    assert.deepEqual(segments(`cd "../a b" && pnpm add x; git status | cat`), [
      ["cd", "../a b"],
      ["pnpm", "add", "x"],
      ["git", "status"],
      ["cat"],
    ]);
  });
});

describe("writingCommands", () => {
  it("follows cd segments", () => {
    assert.deepEqual(writingCommands("cd ../.. && pnpm --filter @cuadre/api add x", root), [
      { command: "pnpm --filter @cuadre/api add x", dir: resolve(root, "../..") },
    ]);
  });

  it("follows PowerShell Set-Location", () => {
    const [found] = writingCommands("Set-Location -Path ../../..; pnpm install", root);
    assert.equal(found?.dir, resolve(root, "../../.."));
  });

  it("follows git -C, pnpm --dir and npm --prefix", () => {
    const dirs = (command) => writingCommands(command, root).map((c) => c.dir);
    assert.deepEqual(dirs(`git -C ${main} commit -m x`), [main]);
    assert.deepEqual(dirs(`pnpm --dir=${main} add x`), [main]);
    assert.deepEqual(dirs(`npm --prefix ${main} install`), [main]);
  });

  it("classifies writing and read-only commands", () => {
    const writes = (command) => writingCommands(command, root).length > 0;
    for (const command of [
      "pnpm install",
      "pnpm -F @cuadre/api remove x",
      "pnpm --filter @cuadre/api db:generate",
      "pnpm exec drizzle-kit generate",
      "npm i",
      "git commit -m x",
      "git -c core.x=y switch main",
      "git stash push -m x",
      "git push",
      "git mv a b",
      "git branch -m new-name",
      "pnpm dlx shadcn@4.23.0 add button",
      "pnpm format",
      "pnpm exec biome check --write .",
      "pnpm --filter @cuadre/web tokens:generate",
      "npm run db:generate",
      "env CI=1 pnpm install",
      "git --work-tree ../.. add .",
    ]) {
      assert.equal(writes(command), true, command);
    }
    for (const command of [
      "pnpm test",
      "pnpm --filter @cuadre/api typecheck",
      "pnpm db:migrate",
      "npm view x",
      "git status",
      "git log --oneline",
      "git diff",
      "git fetch origin",
      "git branch -a",
      "git branch --show-current",
      "ls",
    ]) {
      assert.equal(writes(command), false, command);
    }
  });

  it("does not take cd flags for the target", () => {
    assert.equal(
      writingCommands("cd -P ../.. && git commit -m x", root)[0]?.dir,
      resolve(root, "../.."),
    );
  });

  it("restores the directory after a subshell and popd", () => {
    const dirs = (command) => writingCommands(command, root).map((c) => c.dir);
    assert.deepEqual(dirs("(cd ../.. && git status); git commit -m x"), [root]);
    assert.deepEqual(dirs("pushd ../.. && git log && popd && git commit -m x"), [root]);
  });

  it("looks into bash -c", () => {
    assert.deepEqual(
      writingCommands("bash -c 'cd ../.. && pnpm install'", root).map((c) => c.dir),
      [resolve(root, "../..")],
    );
  });

  it("leaves a directory it cannot resolve undefined", () => {
    assert.equal(writingCommands("cd $HOME/x && pnpm add y", root)[0]?.dir, undefined);
  });
});

describe("isInside", () => {
  it("accepts the root and its children, rejects parents and siblings", () => {
    assert.equal(isInside(root, root), true);
    assert.equal(isInside(root, join(root, "apps/api")), true);
    assert.equal(isInside(root, main), false);
    assert.equal(isInside(root, resolve(root, "../wt2")), false);
    assert.equal(isInside(root, join(root, "..foo")), true);
  });
});

describe("check", () => {
  it("blocks cd ../.. && pnpm add from the worktree root", () => {
    assert.match(
      check("cd ../.. && pnpm --filter @cuadre/api add x", root, root) ?? "",
      /outside it/,
    );
  });

  it("allows the same command inside the worktree", () => {
    assert.equal(check("cd apps/api && pnpm add x", root, root), undefined);
    assert.equal(check("pnpm --filter @cuadre/api add x", root, root), undefined);
  });

  it("blocks a writing command when the shell already sits outside the worktree", () => {
    assert.notEqual(check("git commit -m x", main, root), undefined);
  });

  it("allows read-only commands anywhere", () => {
    assert.equal(check("cd ../.. && git status && pnpm test", root, root), undefined);
  });
});

describe("worktreeRoot", () => {
  const dir = mkdtempSync(join(tmpdir(), "worktree-guard-"));
  after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (cwd, ...args) => {
    const result = spawnSync("git", args, { cwd, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };

  it("is undefined in a main checkout and the worktree top in a linked worktree", () => {
    const repo = join(dir, "repo");
    git(dir, "init", "-q", "repo");
    git(
      repo,
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "x",
    );
    git(repo, "worktree", "add", "-q", join(repo, "wt"));
    assert.equal(worktreeRoot(repo), undefined);
    assert.equal(resolve(worktreeRoot(join(repo, "wt")) ?? ""), resolve(repo, "wt"));
  });

  it("is undefined outside git", () => {
    assert.equal(worktreeRoot(dir), undefined);
  });
});
