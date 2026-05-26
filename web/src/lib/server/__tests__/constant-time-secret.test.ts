import { describe, it, expect } from "vitest";
import { constantTimeEqualSecret } from "@/lib/server/constant-time-secret";

describe("constantTimeEqualSecret", () => {
  it("returns true for two identical non-empty strings", () => {
    expect(constantTimeEqualSecret("hunter2", "hunter2")).toBe(true);
  });

  it("returns true for two identical long strings", () => {
    const s = "x".repeat(256);
    expect(constantTimeEqualSecret(s, s)).toBe(true);
  });

  it("returns false when strings differ", () => {
    expect(constantTimeEqualSecret("hunter2", "hunter3")).toBe(false);
  });

  it("returns false when only one string is empty", () => {
    expect(constantTimeEqualSecret("", "hunter2")).toBe(false);
    expect(constantTimeEqualSecret("hunter2", "")).toBe(false);
  });

  it("returns false when both strings are empty", () => {
    // Empty-vs-empty is treated as 'not equal' so callers using this as a
    // gate cannot pass with an unconfigured/missing secret.
    expect(constantTimeEqualSecret("", "")).toBe(false);
  });

  it("returns false when one string is undefined-as-string", () => {
    // Helper accepts `string` only; passing the literal "undefined" is
    // still a real value and should not match a real secret.
    expect(constantTimeEqualSecret("undefined", "hunter2")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(constantTimeEqualSecret("hunter2", "hunter22")).toBe(false);
    expect(constantTimeEqualSecret("hunter2", "hunte")).toBe(false);
  });

  it("treats unicode-equivalent strings as equal", () => {
    const s = "résumé-Δ-中文";
    expect(constantTimeEqualSecret(s, s)).toBe(true);
  });
});
