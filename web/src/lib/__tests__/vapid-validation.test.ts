import { describe, it, expect } from "vitest";
import { isLikelyValidVapidPublicKey } from "@/lib/vapid-validation";

describe("isLikelyValidVapidPublicKey", () => {
  it("accepts a real-shaped 87-char URL-safe base64 key", () => {
    // 87 URL-safe base64 chars (mix of upper/lower/digits/underscore/dash).
    const key = "B".repeat(43) + "_".repeat(2) + "-".repeat(2) + "A".repeat(40);
    expect(key.length).toBe(87);
    expect(isLikelyValidVapidPublicKey(key)).toBe(true);
  });

  it("rejects empty / wrong-length strings", () => {
    expect(isLikelyValidVapidPublicKey("")).toBe(false);
    expect(isLikelyValidVapidPublicKey("abc")).toBe(false);
    // 86 chars (just short)
    expect(isLikelyValidVapidPublicKey("A".repeat(86))).toBe(false);
    // 88 chars (one too long)
    expect(isLikelyValidVapidPublicKey("A".repeat(88))).toBe(false);
  });

  it("rejects 87-char strings with non URL-safe characters", () => {
    // Standard base64 padding/slashes are NOT URL-safe.
    const withPlus = "A".repeat(86) + "+";
    const withSlash = "A".repeat(86) + "/";
    const withPadding = "A".repeat(86) + "=";
    expect(isLikelyValidVapidPublicKey(withPlus)).toBe(false);
    expect(isLikelyValidVapidPublicKey(withSlash)).toBe(false);
    expect(isLikelyValidVapidPublicKey(withPadding)).toBe(false);
  });

  it("rejects 87-char strings with whitespace", () => {
    const withSpace = "A".repeat(86) + " ";
    expect(isLikelyValidVapidPublicKey(withSpace)).toBe(false);
  });
});
