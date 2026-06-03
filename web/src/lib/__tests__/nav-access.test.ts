import { describe, it, expect } from "vitest";
import type { AppRole, AppCapability } from "@/lib/permissions";
import { canAccessNavHref, canAccessPath } from "@/lib/nav-access";
import { canViewTour } from "@/lib/tours/tourPermissions";
import type { Tour } from "@/lib/tours/types";

/**
 * The tour system must never offer a tour for a page the user's sidebar hides.
 * These tests pin the shared access predicate to the role/capability rules the
 * sidebar uses, and verify the tour permission layer honours them.
 */

function user(appRole: AppRole | null, caps: AppCapability[] = []) {
  return {
    appRole,
    hasCapability: (c: AppCapability) => caps.includes(c),
  };
}

const pageTour = (page: string): Tour => ({
  id: `page-${page}`,
  kind: "page",
  label: "x",
  description: "x",
  page,
  steps: [],
});

describe("canAccessNavHref — role parity with the sidebar", () => {
  it("owner reaches owner-only destinations", () => {
    const owner = user("owner");
    for (const href of ["/dashboard", "/dashboard/overview", "/settings", "/reports", "/garage", "/garage/settings"]) {
      expect(canAccessNavHref(href, owner)).toBe(true);
    }
  });

  it("sales sees sales pages but not garage/admin", () => {
    const sales = user("sales");
    expect(canAccessNavHref("/cars", sales)).toBe(true);
    expect(canAccessNavHref("/customers", sales)).toBe(true);
    expect(canAccessNavHref("/sales-orders", sales)).toBe(true);
    expect(canAccessNavHref("/garage", sales)).toBe(false);
    expect(canAccessNavHref("/garage/inventory", sales)).toBe(false);
    expect(canAccessNavHref("/settings", sales)).toBe(false);
    expect(canAccessNavHref("/reports", sales)).toBe(false);
  });

  it("garage_manager sees garage but not owner settings", () => {
    const gm = user("garage_manager", ["garage", "inventory"]);
    expect(canAccessNavHref("/garage", gm)).toBe(true);
    expect(canAccessNavHref("/garage/inventory", gm)).toBe(true);
    expect(canAccessNavHref("/garage/settings", gm)).toBe(true);
    expect(canAccessNavHref("/garage/warranty", gm)).toBe(true);
    expect(canAccessNavHref("/settings", gm)).toBe(false);
    expect(canAccessNavHref("/dashboard/overview", gm)).toBe(false);
  });

  it("assistant sees requests/cars but not owner dashboard/settings", () => {
    const a = user("assistant");
    expect(canAccessNavHref("/requests", a)).toBe(true);
    expect(canAccessNavHref("/documents", a)).toBe(true);
    expect(canAccessNavHref("/cars", a)).toBe(true);
    expect(canAccessNavHref("/dashboard", a)).toBe(false);
    expect(canAccessNavHref("/settings", a)).toBe(false);
  });

  it("a null role can reach nothing", () => {
    expect(canAccessNavHref("/cars", user(null))).toBe(false);
  });

  it("capability gates work independent of role", () => {
    const cashier = user("sales", ["cashier"]);
    // /garage/purchase-orders is owner | inventory | cashier | manage_team
    expect(canAccessNavHref("/garage/purchase-orders", cashier)).toBe(true);
    expect(canAccessNavHref("/garage/purchase-orders", user("sales"))).toBe(false);
  });
});

describe("canAccessPath — detail/nested routes inherit their list page", () => {
  it("car detail + add inherit /cars access", () => {
    const sales = user("sales");
    expect(canAccessPath("/cars/abc-123", sales)).toBe(true);
    expect(canAccessPath("/cars/add", sales)).toBe(true);
  });

  it("garage job detail inherits /garage access (hidden from sales)", () => {
    expect(canAccessPath("/garage/jobs/xyz", user("garage_staff"))).toBe(true);
    expect(canAccessPath("/garage/jobs/xyz", user("sales"))).toBe(false);
  });

  it("settings sub-pages inherit owner-only /settings", () => {
    expect(canAccessPath("/settings/approval-thresholds", user("owner"))).toBe(true);
    expect(canAccessPath("/settings/approval-thresholds", user("garage_manager"))).toBe(false);
  });

  it("unknown / always-on paths default to accessible", () => {
    expect(canAccessPath("/cash", user("sales"))).toBe(true);
    expect(canAccessPath("/notifications", user("garage_staff"))).toBe(true);
  });
});

describe("canViewTour — page tours hidden when the page is inaccessible", () => {
  it("hides the settings page tour from a non-owner", () => {
    expect(canViewTour(user("owner"), pageTour("/settings"))).toBe(true);
    expect(canViewTour(user("sales"), pageTour("/settings"))).toBe(false);
  });

  it("hides garage page tours from sales", () => {
    expect(canViewTour(user("sales"), pageTour("/garage/inventory"))).toBe(false);
    expect(canViewTour(user("garage_staff"), pageTour("/garage/inventory"))).toBe(true);
  });
});
