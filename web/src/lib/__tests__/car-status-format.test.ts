import { describe, it, expect } from "vitest";
import {
  formatCarStatusLabel,
  CAR_STATUS_LABELS,
  CAR_STATUS_EDITABLE,
} from "@/types/database";
import type { CarStatus } from "@/types/database";

/**
 * formatCarStatusLabel is rendered in tables, badges, and the cars index
 * page. A nullable / empty-string field must show "—", not the literal
 * word "null", and unknown legacy values must be humanised (the cars table
 * still has legacy rows from migration 051's lifecycle revamp).
 */

describe("formatCarStatusLabel", () => {
  it("returns em-dash for null / undefined / empty", () => {
    expect(formatCarStatusLabel(null)).toBe("—");
    expect(formatCarStatusLabel(undefined)).toBe("—");
    expect(formatCarStatusLabel("")).toBe("—");
  });

  it("returns the human label for every known status", () => {
    expect(formatCarStatusLabel("inventory")).toBe("Inventory");
    expect(formatCarStatusLabel("available")).toBe("Available");
    expect(formatCarStatusLabel("reserved")).toBe("Reserved");
    expect(formatCarStatusLabel("sold")).toBe("Sold");
    expect(formatCarStatusLabel("scrapped")).toBe("Scrapped");
  });

  it("humanises an unknown legacy status by replacing underscores", () => {
    // Catches the regression where unknown values rendered "in_transit"
    // verbatim in the UI instead of "in transit".
    expect(formatCarStatusLabel("in_transit")).toBe("in transit");
    expect(formatCarStatusLabel("ready_for_pickup")).toBe("ready for pickup");
  });
});

describe("CAR_STATUS_EDITABLE contract", () => {
  it("excludes 'scrapped' (DB-only soft-remove)", () => {
    // Catches a UI regression: scrapped is a tombstone status, not a
    // user-assignable one — see migration 051 in the type docstring.
    const editable = new Set<CarStatus>(CAR_STATUS_EDITABLE);
    expect(editable.has("scrapped")).toBe(false);
  });

  it("includes the four operational statuses", () => {
    const editable = new Set<CarStatus>(CAR_STATUS_EDITABLE);
    expect(editable.has("inventory")).toBe(true);
    expect(editable.has("available")).toBe(true);
    expect(editable.has("reserved")).toBe(true);
    expect(editable.has("sold")).toBe(true);
  });

  it("every editable value has a human label", () => {
    for (const s of CAR_STATUS_EDITABLE) {
      expect(CAR_STATUS_LABELS[s]).toBeDefined();
      expect(CAR_STATUS_LABELS[s]).not.toBe("");
    }
  });
});
