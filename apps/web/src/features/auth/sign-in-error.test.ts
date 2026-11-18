import { describe, expect, it } from "vitest";
import { toSignInError } from "./sign-in-error.ts";

describe("toSignInError", () => {
  it("maps a wrong password or unknown email (Better Auth 401) to INVALID_CREDENTIALS", () => {
    expect(toSignInError(401, "INVALID_EMAIL_OR_PASSWORD")).toBe("INVALID_CREDENTIALS");
  });

  it("maps Better Auth's rate limit (429) to TOO_MANY_ATTEMPTS", () => {
    expect(toSignInError(429, undefined)).toBe("TOO_MANY_ATTEMPTS");
  });

  it("maps Better Auth's email shape check to INVALID_EMAIL", () => {
    expect(toSignInError(400, "INVALID_EMAIL")).toBe("INVALID_EMAIL");
  });

  it.each([
    [500, undefined],
    [502, undefined],
    [400, "SOMETHING_ELSE"],
    [403, "INVALID_ORIGIN"],
    [401, undefined],
  ])("maps anything else (%i %s) to NETWORK_ERROR", (status, code) => {
    expect(toSignInError(status, code)).toBe("NETWORK_ERROR");
  });
});
