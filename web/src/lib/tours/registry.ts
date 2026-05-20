import type { AppRole } from "@/lib/permissions";
import type { Tour } from "./types";
import { ownerWelcomeTour } from "./tour-owner";
import { carsPageTour } from "./page-cars";
import { customersPageTour } from "./page-customers";
import { addCarWorkflowTour } from "./workflow-add-car";

// ============================================================================
// Welcome tours — one per role. Auto-fired on first login. Manual mode only.
//
// Phase A: owner.
// Phase B: sales, garage_manager, garage_staff.
// Phase C: assistant, hybrid, khalil_hybrid, it, sales_ops.
// ============================================================================
const WELCOME_TOURS: Partial<Record<AppRole, Tour>> = {
  owner: ownerWelcomeTour,
};

// ============================================================================
// Page tours — keyed by path. Offered by the launcher when the current
// pathname matches.
//
// Multiple tours per page are allowed (e.g. one for sales, one for garage).
// Phase 2 will fill these in.
// ============================================================================
const PAGE_TOURS: Record<string, Tour[]> = {
  "/cars": [carsPageTour],
  "/customers": [customersPageTour],
};

// ============================================================================
// Workflow tours — cross-page interactive journeys. Surfaced everywhere.
// Phase 2 will add more.
// ============================================================================
const WORKFLOW_TOURS: Tour[] = [addCarWorkflowTour];

// ============================================================================
// Lookup helpers.
// ============================================================================

function isAllowedForRole(tour: Tour, role: AppRole | null | undefined): boolean {
  if (!tour.allowedRoles || tour.allowedRoles.length === 0) return true;
  if (!role) return false;
  return tour.allowedRoles.includes(role);
}

/**
 * Returns the welcome tour for the given role, or null if none is shipped yet.
 * Used by the auto-fire on first login.
 */
export function getWelcomeTourForRole(role: AppRole | null | undefined): Tour | null {
  if (!role) return null;
  const tour = WELCOME_TOURS[role];
  return tour ?? null;
}

/**
 * Back-compat alias for the legacy "one tour per role" API. New code should
 * use `getWelcomeTourForRole`.
 */
export function getTourForRole(role: AppRole | null | undefined): Tour | null {
  return getWelcomeTourForRole(role);
}

/**
 * Returns all page tours that match the given pathname AND are allowed for
 * the given role. The match is "longest path prefix wins" so a tour
 * registered at "/cars" also fires on "/cars/add" — unless a more specific
 * tour exists at "/cars/add".
 */
export function getPageTours(
  path: string,
  role: AppRole | null | undefined
): Tour[] {
  // Find the longest registered key that the current path starts with.
  const keys = Object.keys(PAGE_TOURS).sort((a, b) => b.length - a.length);
  const match = keys.find((k) => path === k || path.startsWith(k + "/"));
  if (!match) return [];
  return PAGE_TOURS[match].filter((t) => isAllowedForRole(t, role));
}

/**
 * Returns all workflow tours allowed for the given role.
 */
export function getWorkflowTours(role: AppRole | null | undefined): Tour[] {
  return WORKFLOW_TOURS.filter((t) => isAllowedForRole(t, role));
}

/**
 * Returns every tour the launcher should surface on the current page for the
 * given role: welcome (if any) first, then page tours, then workflow tours.
 */
export function getAllAvailableTours(
  path: string,
  role: AppRole | null | undefined
): Tour[] {
  const out: Tour[] = [];
  const welcome = getWelcomeTourForRole(role);
  if (welcome) out.push(welcome);
  out.push(...getPageTours(path, role));
  out.push(...getWorkflowTours(role));
  return out;
}

/**
 * Looks up a tour by id across all three buckets. Used by the
 * `monza:start-tour` event handler to resolve the requested tour.
 */
export function getTourById(id: string): Tour | null {
  for (const t of Object.values(WELCOME_TOURS)) {
    if (t && t.id === id) return t;
  }
  for (const list of Object.values(PAGE_TOURS)) {
    for (const t of list) {
      if (t.id === id) return t;
    }
  }
  for (const t of WORKFLOW_TOURS) {
    if (t.id === id) return t;
  }
  return null;
}
