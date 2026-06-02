import { describe, it, expect } from "vitest";
import { formatHours } from "@/lib/constants/jobs";

describe("formatHours (job estimated/actual hours display)", () => {
  it("rounds a long floating-point tail to two decimals", () => {
    // 2 minutes recorded => 0.03333333… hours
    expect(formatHours(0.0333333333333333)).toBe("0.03");
  });

  it("keeps whole numbers clean (no trailing zeros)", () => {
    expect(formatHours(3)).toBe("3");
  });

  it("keeps a single significant decimal", () => {
    expect(formatHours(3.5)).toBe("3.5");
  });

  it("rounds at the second decimal", () => {
    expect(formatHours(3.456)).toBe("3.46");
  });

  it("renders an em dash for null", () => {
    expect(formatHours(null)).toBe("—");
  });

  it("renders an em dash for undefined", () => {
    expect(formatHours(undefined)).toBe("—");
  });

  it("renders an em dash for NaN", () => {
    expect(formatHours(Number.NaN)).toBe("—");
  });

  it("formats zero as 0", () => {
    expect(formatHours(0)).toBe("0");
  });
});
