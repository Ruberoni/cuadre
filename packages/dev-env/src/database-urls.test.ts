import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { databaseName, defaultDatabaseUrl, worktreeName } from "./database-urls.ts";

describe("databaseName", () => {
  it("keeps today's names in the main checkout", () => {
    expect(databaseName("dev")).toBe("cuadre");
    expect(databaseName("test")).toBe("cuadre_test");
    expect(databaseName("e2e")).toBe("cuadre_e2e");
  });

  it("puts the worktree after cuadre_, so e2e names still end in _e2e", () => {
    expect(databaseName("dev", "issue_10")).toBe("cuadre_issue_10");
    expect(databaseName("test", "issue_10")).toBe("cuadre_issue_10_test");
    expect(databaseName("e2e", "issue_10")).toBe("cuadre_issue_10_e2e");
  });
});

describe("defaultDatabaseUrl", () => {
  it("points at the docker-compose Postgres", () => {
    expect(defaultDatabaseUrl("dev", null)).toBe("postgres://cuadre:cuadre@localhost:5433/cuadre");
    expect(defaultDatabaseUrl("test", "wt")).toBe(
      "postgres://cuadre:cuadre@localhost:5433/cuadre_wt_test",
    );
    expect(defaultDatabaseUrl("e2e", "wt")).toBe(
      "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_wt_e2e",
    );
  });
});

describe("worktreeName", () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-env-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function fileIn(checkout: string, gitIsFile: boolean): string {
    const root = join(dir, checkout);
    mkdirSync(join(root, "packages", "x"), { recursive: true });
    if (gitIsFile) writeFileSync(join(root, ".git"), "gitdir: elsewhere\n");
    else mkdirSync(join(root, ".git"));
    return join(root, "packages", "x", "file.ts");
  }

  it("is undefined in the main checkout", () => {
    expect(worktreeName(fileIn("main", false))).toBeUndefined();
  });

  it("is the worktree directory name, folded to [a-z0-9_]", () => {
    expect(worktreeName(fileIn("Issue-10-ef5e0e", true))).toBe("issue_10_ef5e0e");
  });

  it("is short enough for a Postgres identifier", () => {
    const name = worktreeName(fileIn("a".repeat(80), true)) ?? "";
    expect(databaseName("test", name).length).toBeLessThanOrEqual(63);
  });

  it("is undefined outside git", () => {
    expect(worktreeName(join(dir, "nowhere", "file.ts"))).toBeUndefined();
  });
});
