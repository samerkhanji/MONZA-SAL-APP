// ============================================================================
// Onboarding tour types — v2.
//
// A Tour is a sequence of steps. Tours come in three flavors:
//
//   - "welcome"  — the big map-of-the-app tour that auto-fires on first login.
//                  One per role.
//   - "page"     — short walkthrough of a single page (every button on /cars,
//                  etc.). Surfaced by the launcher when the user is on that
//                  page.
//   - "workflow" — cross-page, task-oriented tour ("add your first car", "sell
//                  a car"). Surfaced everywhere; can navigate the user across
//                  pages and (in interactive mode) wait for real clicks.
//
// Each step targets a `data-tour-id` selector on the page. Steps without an
// element render as full-screen modals (use for "Welcome" / "Done" panes).
// ============================================================================

import type { AppRole, AppCapability } from "@/lib/permissions";

export type TourMode = "manual" | "interactive";

export type WaitFor = "click" | "input" | "navigation";

export type TourStep = {
  /** CSS selector for the element to highlight. Omit for a centered modal. */
  element?: string;
  title: string;
  description: string;
  /** driver.js positioning hints; defaults to "right" / "start". */
  side?: "left" | "right" | "top" | "bottom" | "over";
  align?: "start" | "center" | "end";

  /**
   * Interactive mode: wait for the user to actually click / type / navigate
   * before advancing. In manual mode this field is ignored and the Next
   * button shows up like normal.
   */
  waitFor?: WaitFor;

  /**
   * Some steps require navigation to a different page before they render.
   * The runner navigates first (via Next.js router), then waits for the
   * element to mount, then highlights it.
   */
  navigateTo?: string;
};

export type TourKind = "welcome" | "page" | "workflow";

export type Tour = {
  id: string;
  kind: TourKind;
  label: string;
  description: string;

  /**
   * For "page" tours: the path this tour belongs to (e.g. "/cars"). The page
   * tour is offered when the user is on this path.
   */
  page?: string;

  /** For "workflow" tours: estimated time to complete. */
  estimatedMinutes?: number;

  steps: TourStep[];

  /** Which roles can see / launch this tour. Empty / undefined = all roles. */
  allowedRoles?: AppRole[];

  /**
   * Extra capability gate. If set, the user must have at least one of these
   * capabilities (in addition to passing the page-access check). Used by
   * workflow tours that aren't pinned to a single nav page.
   */
  requiredCapabilities?: AppCapability[];
};
