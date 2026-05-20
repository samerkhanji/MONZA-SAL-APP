import type { Tour } from "./types";

/**
 * Page tour: /garage/recalls/[id] (one recall campaign).
 *
 * Plain-English walkthrough of a single recall — a fix the manufacturer
 * wants done on many cars.
 */
export const garageRecallDetailPageTour: Tour = {
  id: "page-garage-recall-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through a single recall's page.",
  page: "/garage/recalls/[id]",
  steps: [
    {
      element: '[data-tour-id="recall-detail-status"]',
      title: "Change the recall status",
      description:
        "Use this dropdown to move the whole campaign along — open, active, closed, or cancelled.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="recall-detail-summary"]',
      title: "Recall details",
      description:
        "The facts of the recall: the manufacturer, which models and years it affects, the parts needed, and how long the fix takes.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="recall-detail-vehicles"]',
      title: "Affected vehicles",
      description:
        "The list of cars that need this fix. The line at the top shows how many are done out of the total. Use the dropdown on each row to mark a car as scheduled, completed, and so on.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="recall-detail-assign"]',
      title: "Assign vehicles",
      description:
        "Click here to add cars to this recall. The picker is already filtered to the right models and years, so you just tick the ones you own.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="recall-detail-assign-dialog"]',
      title: "The assign-vehicles window",
      description:
        "Search and tick every car that should be in this recall, then press Add. 'Select all visible' is a quick way to grab the whole filtered list at once.",
      side: "over",
      align: "center",
    },
  ],
};
