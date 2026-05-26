import { describe, it, expect } from "vitest";
import { normalizePhone } from "@/lib/phone";

/**
 * normalizePhone mirrors the public.normalize_phone() Postgres function used
 * by the unique partial index on customers.phone_primary (migration 077).
 * If client and server disagree, the customer-create form passes uniqueness
 * locally then 23505s on insert — confusing UX and orphaned form state.
 */

describe("normalizePhone — basic strip rules", () => {
  it("drops spaces, dashes, parens, dots", () => {
    expect(normalizePhone("+961 1 234-5678")).toBe("+96112345678");
    expect(normalizePhone("(961) 1.234.5678")).toBe("96112345678");
    expect(normalizePhone("961-1-234-5678")).toBe("96112345678");
  });

  it("preserves a single leading + (international prefix)", () => {
    expect(normalizePhone("+96112345678")).toBe("+96112345678");
  });

  it("strips leading + when not in first position (e.g. extension)", () => {
    // A '+' anywhere except the leading char is not a valid intl prefix
    // and must be stripped along with other punctuation.
    expect(normalizePhone("961-1-234+5678")).toBe("96112345678");
  });

  it("drops letters silently (Postgres regex equivalent)", () => {
    // Some bookmark/contact apps prepend "Tel:" to numbers.
    expect(normalizePhone("Tel: 961-1-234-5678")).toBe("96112345678");
  });
});

describe("normalizePhone — null / empty handling", () => {
  it("null input returns null", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("undefined input returns null", () => {
    expect(normalizePhone(undefined)).toBeNull();
  });

  it("empty string returns null (not empty string)", () => {
    // The DB unique partial index excludes NULL but treats "" as a value,
    // so the helper must collapse "" → null to match.
    expect(normalizePhone("")).toBeNull();
  });

  it("whitespace-only input returns null", () => {
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("\t\n")).toBeNull();
  });
});

describe("normalizePhone — equivalence (the de-dup contract)", () => {
  it("two formats of the same number normalise to the same string", () => {
    const a = normalizePhone("+961 1 234 5678");
    const b = normalizePhone("+961-1-234-5678");
    const c = normalizePhone("+961.1.234.5678");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("with-+ vs without-+ are different (preserves intl semantics)", () => {
    expect(normalizePhone("+96112345678")).not.toBe(normalizePhone("96112345678"));
  });
});
