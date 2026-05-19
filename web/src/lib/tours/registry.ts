import type { AppRole } from "@/lib/permissions";
import type { Tour } from "./types";
import { ownerTour } from "./tour-owner";

/**
 * Maps each user role to its tour. Tours not yet written fall through to
 * `null`, which means the auto-trigger and "Take the tour" menu entry both
 * stay hidden for that role until we ship its content.
 *
 * Phase A: owner only.
 * Phase B: sales, garage_manager, garage_staff.
 * Phase C: assistant, hybrid, khalil_hybrid, it, sales_ops.
 */
const TOUR_BY_ROLE: Partial<Record<AppRole, Tour>> = {
  owner: ownerTour,
};

export function getTourForRole(role: AppRole | null | undefined): Tour | null {
  if (!role) return null;
  return TOUR_BY_ROLE[role] ?? null;
}
