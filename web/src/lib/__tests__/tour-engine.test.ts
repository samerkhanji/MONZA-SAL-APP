import { describe, it, expect, beforeEach } from "vitest";
import type { AppRole, AppCapability } from "@/lib/permissions";
import { canViewTourStep } from "@/lib/tours/tourPermissions";
import type { TourStep } from "@/lib/tours/types";
import {
  recordTourProgress,
  getTourStatus,
  getTourProgress,
} from "@/lib/tours/tourProgress";

function user(appRole: AppRole | null, caps: AppCapability[] = []) {
  return { appRole, hasCapability: (c: AppCapability) => caps.includes(c) };
}

const step = (extra: Partial<TourStep>): TourStep => ({
  title: "x",
  description: "x",
  ...extra,
});

describe("canViewTourStep — step-level gating", () => {
  it("shows ungated steps to everyone", () => {
    expect(canViewTourStep(user("sales"), step({}))).toBe(true);
  });

  it("hides a step from roles not in visibleToRoles", () => {
    const s = step({ visibleToRoles: ["owner"] });
    expect(canViewTourStep(user("owner"), s)).toBe(true);
    expect(canViewTourStep(user("sales"), s)).toBe(false);
  });

  it("requires at least one of requiredCapabilities", () => {
    const s = step({ requiredCapabilities: ["cashier"] });
    expect(canViewTourStep(user("sales", ["cashier"]), s)).toBe(true);
    expect(canViewTourStep(user("sales", []), s)).toBe(false);
  });

  it("applies both gates together", () => {
    const s = step({ visibleToRoles: ["garage_manager"], requiredCapabilities: ["garage"] });
    expect(canViewTourStep(user("garage_manager", ["garage"]), s)).toBe(true);
    expect(canViewTourStep(user("garage_manager", []), s)).toBe(false);
    expect(canViewTourStep(user("owner", ["garage"]), s)).toBe(false);
  });
});

describe("tourProgress — localStorage tracking", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reports not-started for an unseen tour", () => {
    expect(getTourStatus("u1", "page-x")).toBe("not-started");
  });

  it("records an abandoned run as in-progress and remembers the step", () => {
    recordTourProgress("u1", "page-x", 2, 8, false);
    expect(getTourStatus("u1", "page-x")).toBe("in-progress");
    expect(getTourProgress("u1", "page-x")?.lastStep).toBe(2);
  });

  it("records a finished run as completed", () => {
    recordTourProgress("u1", "page-x", 7, 8, true);
    expect(getTourStatus("u1", "page-x")).toBe("completed");
  });

  it("keeps completed sticky even if reopened and abandoned early", () => {
    recordTourProgress("u1", "page-x", 7, 8, true);
    recordTourProgress("u1", "page-x", 1, 8, false);
    expect(getTourStatus("u1", "page-x")).toBe("completed");
  });

  it("scopes progress per user", () => {
    recordTourProgress("u1", "page-x", 7, 8, true);
    expect(getTourStatus("u2", "page-x")).toBe("not-started");
  });
});
