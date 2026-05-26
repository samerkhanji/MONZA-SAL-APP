import { describe, it, expect } from "vitest";

/**
 * VIN validation contract.
 *
 * The 17-character VIN regex is currently duplicated across:
 *   - components/scanner/ScannerDialog.tsx
 *   - app/(dashboard)/cars/add/page.tsx
 *   - app/(dashboard)/test-drive/page.tsx
 *   - app/(dashboard)/documents/page.tsx
 *   - app/(dashboard)/ordered-cars/page.tsx
 *
 * Until a shared helper lands, these tests pin the contract every call site
 * is expected to honour:
 *   - exactly 17 characters
 *   - no I, O, or Q (NHTSA standard — they look like 1 / 0)
 *   - case-insensitive (validators upper-case before checking)
 *
 * If any call site drifts, a follow-up test for that file will fail; this
 * file ensures the contract itself is well-defined.
 */

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

function isValidVin(raw: string): boolean {
  return VIN_REGEX.test(raw.trim().toUpperCase());
}

describe("VIN length", () => {
  it("rejects shorter than 17 characters", () => {
    expect(isValidVin("1HGCM82633A00475")).toBe(false); // 16
  });

  it("rejects longer than 17 characters", () => {
    expect(isValidVin("1HGCM82633A0047559")).toBe(false); // 18
  });

  it("rejects empty string", () => {
    expect(isValidVin("")).toBe(false);
  });

  it("accepts exactly 17 characters", () => {
    expect(isValidVin("1HGCM82633A004752")).toBe(true);
  });
});

describe("VIN character set", () => {
  it("rejects letter I (looks like 1)", () => {
    expect(isValidVin("1HGCM82633A00475I")).toBe(false);
  });

  it("rejects letter O (looks like 0)", () => {
    expect(isValidVin("1HGCM82633A00475O")).toBe(false);
  });

  it("rejects letter Q (looks like 0)", () => {
    expect(isValidVin("1HGCM82633A00475Q")).toBe(false);
  });

  it("rejects non-alphanumeric (space, dash, dot)", () => {
    expect(isValidVin("1HGCM82633A0047 5")).toBe(false);
    expect(isValidVin("1HGCM82633A0047-5")).toBe(false);
    expect(isValidVin("1HGCM82633A0047.5")).toBe(false);
  });

  it("accepts all digits 0-9", () => {
    expect(isValidVin("12345678901234567")).toBe(true);
  });

  it("accepts all allowed uppercase letters", () => {
    // Mix of each row of the allowed alphabet (no I/O/Q).
    expect(isValidVin("ABCDEFGHJKLMNPRST")).toBe(true);
    expect(isValidVin("UVWXYZABCDEFGHJKL")).toBe(true);
  });
});

describe("VIN case handling", () => {
  it("accepts lowercase (normalizers upper-case before checking)", () => {
    expect(isValidVin("1hgcm82633a004752")).toBe(true);
  });

  it("accepts mixed case", () => {
    expect(isValidVin("1HgCm82633A004752")).toBe(true);
  });

  it("trims whitespace before validating (scanned VINs often have padding)", () => {
    expect(isValidVin("  1HGCM82633A004752  ")).toBe(true);
  });
});

describe("VIN regex shape (defence against accidental relaxation)", () => {
  it("is anchored start-to-end (no partial matches)", () => {
    // A bug-prone implementation would write /[A-Z0-9]{17}/ without
    // anchors, accepting any 17-char window inside a longer string.
    expect(VIN_REGEX.source.startsWith("^")).toBe(true);
    expect(VIN_REGEX.source.endsWith("$")).toBe(true);
  });

  it("does not allow I/O/Q in its character class", () => {
    // Pin the character class so an edit can't silently re-admit I/O/Q.
    expect(VIN_REGEX.source).not.toContain("I");
    expect(VIN_REGEX.source).not.toContain("O");
    expect(VIN_REGEX.source).not.toContain("Q");
  });
});
