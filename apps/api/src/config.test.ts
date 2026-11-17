import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("falls back to development defaults when the environment is empty", () => {
    const config = loadConfig({});
    expect(config.API_PORT).toBe(3000);
    expect(config.DATABASE_URL).toContain("localhost:5433/cuadre");
  });

  it("lets the environment override the defaults", () => {
    expect(loadConfig({ API_PORT: "4100" }).API_PORT).toBe(4100);
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ API_PORT: "not-a-port" })).toThrow();
  });
});
