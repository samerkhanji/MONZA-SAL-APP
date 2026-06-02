import { describe, it, expect } from "vitest";
import { sanitizeText } from "@/lib/validation/sanitize";

describe("sanitizeText (strip HTML from persisted free-text)", () => {
  it("strips a stored XSS script payload down to harmless text", () => {
    expect(sanitizeText("<script>alert('XSS')</script>")).toBe("alert('XSS')");
  });

  it("removes inline tags but keeps the readable label", () => {
    expect(sanitizeText("Brake <b>pad</b> replacement")).toBe(
      "Brake pad replacement"
    );
  });

  it("strips an img onerror payload", () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>Oil change')).toBe(
      "Oil change"
    );
  });

  it("collapses whitespace left behind by removed tags", () => {
    expect(sanitizeText("A  <span></span>  B")).toBe("A B");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("returns empty string when input is only markup", () => {
    expect(sanitizeText("<div></div>")).toBe("");
  });

  it("leaves a plain title untouched", () => {
    expect(sanitizeText("Front brake pads")).toBe("Front brake pads");
  });
});
