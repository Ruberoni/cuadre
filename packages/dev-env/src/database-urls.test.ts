import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { databaseName, defaultDatabaseUrl, worktreeName } from "./database-urls.ts";

describe("databaseName", () => {
  it("keeps today's names in the main checkout", () => {
    expect(databaseName("dev")).toBe("cuadre");
    expect(databaseName("test")).toBe("cuadre_test");
    expect(databaseName("e2e")).toBe("cuadre_e2e");
  });

  it("namespaces worktree databases, so only e2e names end in _e2e", () => {
    expect(databaseName("dev", "issue_10_abc123")).toBe("cuadre_wt_issue_10_abc123__dev");
    expect(databaseName("test", "issue_10_abc123")).toBe("cuadre_wt_issue_10_abc123__test");
    expect(databaseName("e2e", "issue_10_abc123")).toBe("cuadre_wt_issue_10_abc123__e2e");
  });

  it.each(["test", "e2e", "foo_e2e"])("never gives worktree %s a main-checkout name", (name) => {
    const names = (["dev", "test", "e2e"] as const).map((kind) => databaseName(kind, name));
    for (const main of ["cuadre", "cuadre_test", "cuadre_e2e"]) expect(names).not.toContain(main);
    expect(names.filter((n) => n.endsWith("_e2e"))).toEqual([`cuadre_wt_${name}__e2e`]);
  });
});

describe("defaultDatabaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("points at the docker-compose Postgres", () => {
    vi.stubEnv("POSTGRES_PORT", undefined);
    expect(defaultDatabaseUrl("dev", null)).toBe("postgres://cuadre:cuadre@localhost:5433/cuadre");
    expect(defaultDatabaseUrl("e2e", "wt")).toBe(
      "postgres://cuadre:cuadre@127.0.0.1:5433/cuadre_wt_wt__e2e",
    );
  });

  it("follows POSTGRES_PORT like docker-compose.yml", () => {
    vi.stubEnv("POSTGRES_PORT", "5434");
    expect(defaultDatabaseUrl("test", null)).toBe(
      "postgres://cuadre:cuadre@localhost:5434/cuadre_test",
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
    else mkdirSync(join(root, ".git"), { recursive: true });
    return join(root, "packages", "x", "file.ts");
  }

  it("is undefined in the main checkout", () => {
    expect(worktreeName(fileIn("main", false))).toBeUndefined();
  });

  it("is the folded directory name plus a hash of its path", () => {
    expect(worktreeName(fileIn("Issue-10--ef5e0e", true))).toMatch(/^issue_10_ef5e0e_[0-9a-f]{6}$/);
  });

  it("tells apart two worktrees with the same directory name", () => {
    const a = worktreeName(fileIn(join("a", "pr-57"), true));
    const b = worktreeName(fileIn(join("b", "pr-57"), true));
    expect(a).not.toBe(b);
  });

  it("still names a directory that folds to nothing", () => {
    expect(worktreeName(fileIn("---", true))).toMatch(/^[0-9a-f]{6}$/);
  });

  it("is short enough for a Postgres identifier, without __ inside", () => {
    const name = worktreeName(fileIn("a_".repeat(60), true)) ?? "";
    expect(databaseName("test", name).length).toBeLessThanOrEqual(63);
    expect(name).not.toContain("__");
  });

  it("is undefined outside git", () => {
    expect(worktreeName(join(dir, "nowhere", "file.ts"))).toBeUndefined();
  });
});
