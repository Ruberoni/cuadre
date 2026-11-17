import { describe, expect, it } from "vitest";
import { router } from "./router.ts";

describe("router", () => {
  it("has an index route", () => {
    expect(router.routesByPath["/"]).toBeDefined();
  });
});
