// ============================================================================
// Onboarding tour types.
//
// A Tour is a sequence of steps, each with a target (CSS selector pointing to
// a `data-tour-id` element) and a child-friendly description. The selector is
// optional — steps without an element render as full-screen modals (use for
// "Welcome" / "Done" panes).
// ============================================================================

export type TourStep = {
  /** CSS selector for the element to highlight. Omit for a centered modal. */
  element?: string;
  title: string;
  description: string;
  /** driver.js positioning hints; defaults to "right" / "start". */
  side?: "left" | "right" | "top" | "bottom" | "over";
  align?: "start" | "center" | "end";
};

export type Tour = {
  id: string;
  /** Display label for the "Take the tour" menu. */
  label: string;
  /** Plain-English description shown above the menu entry. */
  description: string;
  steps: TourStep[];
};
