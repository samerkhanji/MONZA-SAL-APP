// ============================================================================
// Tour permission layer.
//
// The tour launcher must never offer a tour for a page the user cannot open.
// These helpers reuse `canAccessPath` from `@/lib/nav-access` — the exact same
// role/capability rules the sidebar uses — so tour visibility and navigation
// visibility can never drift apart.
// ============================================================================

import type { AppRole } from "@/lib/permissions";
import type { NavAccessUser } from "@/lib/nav-access";
import { canAccessPath } from "@/lib/nav-access";
import type { Tour } from "./types";
import {
  getRawPageTours,
  getAllWorkflowTours,
  getAllPageTours,
  getRelatedWorkflows,
  getWelcomeTourForRole,
} from "./registry";

/** Everything the permission layer needs about the current user. */
export type TourUser = NavAccessUser;

function passesRole(tour: Tour, role: AppRole | null): boolean {
  if (!tour.allowedRoles || tour.allowedRoles.length === 0) return true;
  if (!role) return false;
  return tour.allowedRoles.includes(role);
}

function passesCapabilities(tour: Tour, user: TourUser): boolean {
  if (!tour.requiredCapabilities || tour.requiredCapabilities.length === 0) {
    return true;
  }
  return tour.requiredCapabilities.some((c) => user.hasCapability(c));
}

/**
 * Can this user see / launch a given tour?
 *  - role gate (allowedRoles)
 *  - capability gate (requiredCapabilities)
 *  - page gate: a page tour is only visible if the user can open its page.
 */
export function canViewTour(user: TourUser, tour: Tour): boolean {
  if (!user.appRole) return false;
  if (!passesRole(tour, user.appRole)) return false;
  if (!passesCapabilities(tour, user)) return false;
  if (tour.kind === "page" && tour.page && !canAccessPath(tour.page, user)) {
    return false;
  }
  return true;
}

/** Page tour(s) for the current path the user is allowed to see. */
export function getToursForCurrentPage(pathname: string, user: TourUser): Tour[] {
  return getRawPageTours(pathname).filter((t) => canViewTour(user, t));
}

/**
 * Related workflow tours for the current page, filtered by both the tour's own
 * gates and the optional `gatePath` (e.g. "Sell a car" only where the user has
 * sales access).
 */
export function getRelatedWorkflowTours(
  pathname: string,
  user: TourUser
): Tour[] {
  return getRelatedWorkflows(pathname)
    .filter(({ tour, gatePath }) => {
      if (!canViewTour(user, tour)) return false;
      if (gatePath && !canAccessPath(gatePath, user)) return false;
      return true;
    })
    .map(({ tour }) => tour);
}

/** The owner/admin "map of the whole app" tour, if the user may see it. */
export function getFullAppTour(user: TourUser): Tour | null {
  const welcome = getWelcomeTourForRole(user.appRole);
  if (!welcome) return null;
  return canViewTour(user, welcome) ? welcome : null;
}

/**
 * Every tour the user can access anywhere (page + workflow), de-duplicated.
 * Backs a potential "all guides" view; the launcher itself is page-first.
 */
export function getAvailableTours(user: TourUser): Tour[] {
  const seen = new Set<string>();
  const out: Tour[] = [];
  const push = (t: Tour) => {
    if (!seen.has(t.id) && canViewTour(user, t)) {
      seen.add(t.id);
      out.push(t);
    }
  };
  getAllPageTours().forEach(push);
  getAllWorkflowTours().forEach(push);
  return out;
}
