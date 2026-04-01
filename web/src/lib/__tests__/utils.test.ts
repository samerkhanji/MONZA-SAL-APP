import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names correctly", () => {
    const result = cn("a", false && "b", "c", ["d", { e: true, f: false }]);
    expect(result).toContain("a");
    expect(result).toContain("c");
    expect(result).toContain("d");
    expect(result).toContain("e");
    expect(result).not.toContain("f");
  });
});

