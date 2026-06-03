// ============================================================================
// Step presentation helpers.
//
// Tour steps are painted by driver.js (the runner in TourProvider drives it).
// This module owns the cross-cutting step concerns: the centered fallback shown
// when a step's target element is missing, and the editorial step-type labels.
// ============================================================================

import type { TourStepType } from "@/lib/tours/types";

/**
 * Shown as a centered modal (with the step's own body) when a step's target
 * `data-tour-id` / selector is not on the page — instead of crashing or
 * highlighting nothing. The runner also console.warns the missing selector.
 */
export const MISSING_SELECTOR_FALLBACK =
  "This element is not available on your screen, but here is what it does.";

/** Human label for a step's editorial type (overview / action / warning …). */
export function stepTypeLabel(type?: TourStepType): string | null {
  switch (type) {
    case "overview":
      return "Overview";
    case "section":
      return "Section";
    case "action":
      return "Action";
    case "warning":
      return "Warning";
    case "workflow":
      return "Workflow";
    case "summary":
      return "Summary";
    default:
      return null;
  }
}
