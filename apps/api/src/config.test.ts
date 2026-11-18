import { describe, expect, it } from "vitest";
import { DEV_AUTH_SECRET, loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("falls back to development defaults when the environment is empty", () => {
    const config = loadConfig({});
    expect(config.API_PORT).toBe(3000);
    expect(config.DATABASE_URL).toContain("localhost:5433/cuadre");
    expect(config.BETTER_AUTH_SECRET).toBe(DEV_AUTH_SECRET);
    expect(config.BETTER_AUTH_URL).toBe("http://localhost:5173");
  });

  it("lets the environment override the defaults", () => {
    expect(loadConfig({ API_PORT: "4100" }).API_PORT).toBe(4100);
  });

  it("rejects an invalid port", () => {
    expect(() => loadConfig({ API_PORT: "not-a-port" })).toThrow();
  });

  describe("auth", () => {
    it("trusts the default dev origin on localhost and 127.0.0.1", () => {
      expect(loadConfig({}).trustedOrigins).toEqual([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ]);
    });

    it("trusts only the configured origin plus the extra list otherwise", () => {
      const config = loadConfig({
        BETTER_AUTH_URL: "http://127.0.0.1:4173",
        BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:4173, http://example.test",
      });
      expect(config.trustedOrigins).toEqual([
        "http://127.0.0.1:4173",
        "http://localhost:4173",
        "http://example.test",
      ]);
    });

    it("rejects a secret shorter than 32 characters", () => {
      expect(() => loadConfig({ BETTER_AUTH_SECRET: "short" })).toThrow();
    });

    it("requires an explicit secret in production", () => {
      expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
      expect(() =>
        loadConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: DEV_AUTH_SECRET }),
      ).toThrow(/BETTER_AUTH_SECRET/);
      const secret = "x".repeat(32);
      expect(
        loadConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret }).BETTER_AUTH_SECRET,
      ).toBe(secret);
    });
  });
});
