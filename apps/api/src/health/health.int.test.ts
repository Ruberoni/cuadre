import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app.ts";
import { loadConfig } from "../config.ts";
import { createDb } from "../db/client.ts";

const real = createDb(loadConfig().DATABASE_URL_TEST);
// Nothing listens on port 1: stands in for "Postgres is stopped".
const unreachable = createDb("postgres://cuadre:cuadre@127.0.0.1:1/cuadre");

afterAll(async () => {
  await real.close();
  await unreachable.close();
});

describe("GET /health", () => {
  it("answers 200 when the database is reachable", async () => {
    const res = await createApp({ db: real.db }).request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "up" });
  });

  it("does not answer 200 when the database is down", async () => {
    const res = await createApp({ db: unreachable.db }).request("/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error", database: "down" });
  });

  it("serves the OpenAPI document", async () => {
    const res = await createApp({ db: real.db }).request("/openapi.json");
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toContain("/health");
  });
});
