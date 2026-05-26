import { describe, it, expect } from "vitest";
import {
  DEALERSHIP_TZ,
  dateKeyInTz,
  monthKeyInTz,
  weekStartKeyInTz,
  shiftDateKey,
  formatInTz,
} from "@/lib/dealership-tz";

/**
 * Beirut timezone bucket helpers.
 *
 * Migration 118 (118_business_date_beirut_tz.sql) moved every "today" /
 * "this week" / "this month" bucket to the dealership's local clock. These
 * tests pin that contract: the cut-over moments (UTC midnight, end of
 * month, leap day, DST) must attribute events to the Beirut business day
 * the dealership actually saw, not whatever calendar the viewer's browser
 * is on.
 *
 * Asia/Beirut is UTC+2 in winter and UTC+3 during DST (last Sunday of
 * March → last Sunday of October).
 */

describe("DEALERSHIP_TZ constant", () => {
  it("is pinned to Asia/Beirut", () => {
    expect(DEALERSHIP_TZ).toBe("Asia/Beirut");
  });
});

describe("dateKeyInTz — business-day attribution", () => {
  it("23:00 UTC on 2026-05-26 falls on 2026-05-27 in Beirut (UTC+3 DST)", () => {
    // The dealership has already closed and a service technician's
    // last clock-out at 02:00 local must bucket into the NEXT business
    // day. A naïve UTC-based bucket would mis-credit it to 2026-05-26.
    const at = new Date("2026-05-26T23:00:00Z");
    expect(dateKeyInTz(at)).toBe("2026-05-27");
  });

  it("21:00 UTC on 2026-05-26 still falls on 2026-05-27 (DST)", () => {
    const at = new Date("2026-05-26T21:00:00Z");
    expect(dateKeyInTz(at)).toBe("2026-05-27");
  });

  it("20:59 UTC on 2026-05-26 still falls on 2026-05-26 in Beirut", () => {
    // Sanity: one minute before the cut-over remains on the prior day.
    const at = new Date("2026-05-26T20:59:00Z");
    expect(dateKeyInTz(at)).toBe("2026-05-26");
  });

  it("22:00 UTC on 2026-01-15 falls on 2026-01-16 in winter (UTC+2)", () => {
    // Winter cut-over is 22:00 UTC, not 21:00; this catches a hand-rolled
    // offset-based implementation that hard-codes +3.
    const at = new Date("2026-01-15T22:00:00Z");
    expect(dateKeyInTz(at)).toBe("2026-01-16");
  });

  it("21:59 UTC on 2026-01-15 stays on 2026-01-15 in winter", () => {
    const at = new Date("2026-01-15T21:59:00Z");
    expect(dateKeyInTz(at)).toBe("2026-01-15");
  });

  it("attribution does not depend on the host machine TZ (UTC noon is unambiguous)", () => {
    const at = new Date("2026-07-01T12:00:00Z");
    expect(dateKeyInTz(at)).toBe("2026-07-01");
  });
});

describe("monthKeyInTz", () => {
  it("returns YYYY-MM in Beirut", () => {
    expect(monthKeyInTz(new Date("2026-07-15T10:00:00Z"))).toBe("2026-07");
  });

  it("month rolls over at Beirut midnight, not UTC midnight (DST cut-over)", () => {
    // 2026-04-30 23:30 UTC is 2026-05-01 02:30 in Beirut (DST). The
    // monthly bucket must say 2026-05.
    expect(monthKeyInTz(new Date("2026-04-30T23:30:00Z"))).toBe("2026-05");
  });
});

describe("weekStartKeyInTz — Monday-first week bucket", () => {
  it("Monday returns itself", () => {
    // 2026-05-25 is a Monday.
    expect(weekStartKeyInTz(new Date("2026-05-25T12:00:00Z"))).toBe("2026-05-25");
  });

  it("Sunday returns the prior Monday (6 days back)", () => {
    // 2026-05-24 is a Sunday — Monday-first week starts 2026-05-18.
    expect(weekStartKeyInTz(new Date("2026-05-24T12:00:00Z"))).toBe("2026-05-18");
  });

  it("Wednesday returns Monday of the same week", () => {
    // 2026-05-27 is a Wednesday.
    expect(weekStartKeyInTz(new Date("2026-05-27T12:00:00Z"))).toBe("2026-05-25");
  });
});

describe("shiftDateKey — pure calendar arithmetic", () => {
  it("forward shift handles month boundaries", () => {
    expect(shiftDateKey("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("backward shift handles month boundaries", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles leap-year February", () => {
    expect(shiftDateKey("2024-02-28", 1)).toBe("2024-02-29");
    expect(shiftDateKey("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("handles year boundary", () => {
    expect(shiftDateKey("2025-12-31", 1)).toBe("2026-01-01");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("zero-shift returns the same key", () => {
    expect(shiftDateKey("2026-05-26", 0)).toBe("2026-05-26");
  });

  it("does not get tripped up by DST (week-long span across DST cut-over)", () => {
    // 2026-03-29 02:00 is the spring-forward in Asia/Beirut. The helper
    // must NOT drop an hour and snap to the previous day. Going from
    // 2026-03-25 +7 days must land on 2026-04-01.
    expect(shiftDateKey("2026-03-25", 7)).toBe("2026-04-01");
  });
});

describe("formatInTz", () => {
  it("returns em-dash for null / undefined / invalid input", () => {
    expect(formatInTz(null)).toBe("—");
    expect(formatInTz(undefined)).toBe("—");
    expect(formatInTz("not a date")).toBe("—");
  });

  it("accepts both Date and ISO string", () => {
    const d = new Date("2026-05-26T12:00:00Z");
    const fromDate = formatInTz(d);
    const fromIso = formatInTz("2026-05-26T12:00:00Z");
    expect(fromDate).toBe(fromIso);
    expect(fromDate).toMatch(/2026/);
  });
});
