import { describe, expect, it } from "vitest";
import { err, type Result } from "./index.ts";
import { invalid, type ValidationFailure } from "./validation.ts";

type Field = "sku" | "name";
type Code = "REQUIRED" | "TOO_LONG";

describe("invalid", () => {
  it("builds a failed result that names every field issue", () => {
    const failure = invalid<Field, Code>([
      { field: "sku", code: "REQUIRED" },
      { field: "name", code: "TOO_LONG" },
    ]);

    expect(failure).toEqual({
      ok: false,
      error: "VALIDATION_ERROR",
      issues: [
        { field: "sku", code: "REQUIRED" },
        { field: "name", code: "TOO_LONG" },
      ],
    });
  });

  it("is told apart from other expected failures by its error code", () => {
    const outcome = invalid<Field, Code>([{ field: "sku", code: "REQUIRED" }]) as
      | Result<string, "SKU_ALREADY_EXISTS">
      | ValidationFailure<Field, Code>;

    if (outcome.ok) throw new Error("expected a failure");
    if (outcome.error === "VALIDATION_ERROR") {
      expect(outcome.issues).toHaveLength(1);
    } else {
      expect(outcome.error).toBe("SKU_ALREADY_EXISTS");
    }
  });

  it("does not collide with a plain Result failure", () => {
    expect(err("SKU_ALREADY_EXISTS")).not.toHaveProperty("issues");
  });
});
