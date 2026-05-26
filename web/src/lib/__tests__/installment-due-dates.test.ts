import { describe, it, expect } from "vitest";
import { installmentDueDateIso } from "@/lib/installment-due-dates";

/**
 * Catches the original bug noted in the source: a previous implementation
 * round-tripped through toISOString() which converts local midnight to UTC
 * and shifted the day backwards in Beirut (UTC+2/+3). These tests pin the
 * corrected behaviour — same calendar day, no off-by-one in any month.
 */

describe("installmentDueDateIso — basic offsets", () => {
  it("month offset 0 returns the same calendar month", () => {
    expect(installmentDueDateIso("2026-01-15", 0, 15)).toBe("2026-01-15");
  });

  it("month offset 1 returns next month, same due_day", () => {
    expect(installmentDueDateIso("2026-01-15", 1, 15)).toBe("2026-02-15");
  });

  it("year wraps after 12 months", () => {
    expect(installmentDueDateIso("2026-05-10", 12, 10)).toBe("2027-05-10");
  });

  it("36-month plan ends 3 years later", () => {
    expect(installmentDueDateIso("2026-01-10", 36, 10)).toBe("2029-01-10");
  });
});

describe("installmentDueDateIso — clamping due_day to end-of-month", () => {
  it("due_day 31 → Feb 28 in a non-leap year", () => {
    expect(installmentDueDateIso("2026-01-31", 1, 31)).toBe("2026-02-28");
  });

  it("due_day 31 → Feb 29 in a leap year", () => {
    expect(installmentDueDateIso("2024-01-31", 1, 31)).toBe("2024-02-29");
  });

  it("due_day 31 → 30 in April (30-day month)", () => {
    expect(installmentDueDateIso("2026-01-31", 3, 31)).toBe("2026-04-30");
  });

  it("due_day 31 stays at 31 in 31-day months", () => {
    expect(installmentDueDateIso("2026-01-31", 2, 31)).toBe("2026-03-31");
  });
});

describe("installmentDueDateIso — guards on due_day input", () => {
  it("due_day 0 clamps to day 1 (avoid going into previous month)", () => {
    expect(installmentDueDateIso("2026-05-01", 0, 0)).toBe("2026-05-01");
  });

  it("due_day negative clamps to day 1", () => {
    expect(installmentDueDateIso("2026-05-01", 0, -5)).toBe("2026-05-01");
  });

  it("due_day way larger than 31 still clamps to month-end", () => {
    expect(installmentDueDateIso("2026-02-01", 0, 99)).toBe("2026-02-28");
  });
});

describe("installmentDueDateIso — no off-by-one in positive-offset timezones", () => {
  it("plan start on Jan 1 stays on Jan 1 (regression from toISOString bug)", () => {
    // Previously this returned 2025-12-31 because midnight Beirut became
    // 22:00 UTC the previous day. Pinning this prevents reintroducing it.
    expect(installmentDueDateIso("2026-01-01", 0, 1)).toBe("2026-01-01");
  });

  it("plan start on last day of year keeps year integrity", () => {
    expect(installmentDueDateIso("2026-12-31", 0, 31)).toBe("2026-12-31");
  });
});

describe("installmentDueDateIso — output shape", () => {
  it("returns ISO YYYY-MM-DD form (10 chars, dashes only)", () => {
    const out = installmentDueDateIso("2026-05-26", 0, 15);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(out).toHaveLength(10);
  });
});
