import type { Tour } from "./types";

/**
 * Page tour: /garage/recalls.
 *
 * Plain-English walkthrough of the recalls list. A "recall" is when the
 * manufacturer asks for the same fix on many cars at once — for example
 * because a part turned out to be faulty.
 */
export const garageRecallsPageTour: Tour = {
  id: "page-garage-recalls-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Recalls page.",
  page: "/garage/recalls",
  steps: [
    {
      element: '[data-tour-id="recalls-new"]',
      title: "New recall",
      description:
        "Click here when the manufacturer announces a recall — a fix that must be done on many cars. You give it a title, the affected models, and the years. Then you add the cars on the next screen.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="recalls-status-tabs"]',
      title: "Status tabs",
      description:
        "Each tab shows recalls at one stage — open, active, closed, or cancelled. Click a tab to see only those. The number tells you how many.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="recalls-search"]',
      title: "Search box",
      description:
        "Type a recall number, a title, or a car model to find one recall fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="recalls-table"]',
      title: "The recalls list",
      description:
        "Every recall campaign. The Progress column shows how many affected cars are done out of the total — so you can see how far along the campaign is. Click any row to open it.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="recalls-new-dialog"]',
      title: "The new-recall form",
      description:
        "This window asks for the recall title, what it's about, which manufacturer and models it affects, the year range, the parts needed, and the time it takes. Fill it in and press 'Create recall'.",
      side: "over",
      align: "center",
    },
  ],
};
