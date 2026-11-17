import { describe, expect, it } from "vitest";
import { e2eDatabaseUrl, prepareE2eDatabase } from "./e2e-prepare.ts";

describe("e2eDatabaseUrl", () => {
  it("defaults to the cuadre_e2e database", () => {
    expect(e2eDatabaseUrl({})).toContain("/cuadre_e2e");
  });

  it("honours DATABASE_URL_E2E", () => {
    expect(e2eDatabaseUrl({ DATABASE_URL_E2E: "postgres://u:p@host:1/other_e2e" })).toBe(
      "postgres://u:p@host:1/other_e2e",
    );
  });
});

describe("prepareE2eDatabase", () => {
  it.each(["cuadre", "cuadre_test", "postgres", "cuadre_e2e; drop database cuadre"])(
    "refuses to touch %s",
    async (name) => {
      const url = `postgres://cuadre:cuadre@127.0.0.1:1/${encodeURIComponent(name)}`;
      await expect(prepareE2eDatabase(url, { fresh: true })).rejects.toThrow(/Refusing/);
    },
  );
});
