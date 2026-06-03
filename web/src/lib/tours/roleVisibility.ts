// ============================================================================
// Role / capability visibility for tours — the public permission API.
//
// All of this reuses `canAccessPath` from @/lib/nav-access, i.e. the SAME
// role/capability rules the sidebar uses, so a tour is never offered for a page
// the user cannot open. This module is the v3-named entry point; the logic
// lives in ./tourPermissions and @/lib/nav-access.
// ============================================================================

import type { Tour } from "./types";
import {
  getToursForCurrentPage,
  type TourUser,
} from "./tourPermissions";

export type { TourUser } from "./tourPermissions";

export {
  canViewTour,
  canViewTourStep,
  visibleTourSteps,
  getToursForCurrentPage,
  getRelatedWorkflowTours,
  getAvailableTours,
  getFullAppTour,
} from "./tourPermissions";

export { canAccessPath, canAccessNavHref } from "@/lib/nav-access";

/**
 * The single primary guide for the current page (the first the user may see),
 * or null. Convenience over `getToursForCurrentPage` when you only want one.
 */
export function getCurrentPageTour(
  pathname: string,
  user: TourUser
): Tour | null {
  return getToursForCurrentPage(pathname, user)[0] ?? null;
}
