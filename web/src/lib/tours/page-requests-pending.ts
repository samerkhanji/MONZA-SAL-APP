import type { Tour } from "./types";

/**
 * Page tour: /requests/pending (short tour).
 *
 * The pending queue — everything that needs an owner or manager to approve or
 * deny it: deletions, employee requests, document access, page access.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const requestsPendingPageTour: Tour = {
  id: "page-requests-pending-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the pending requests queue.",
  page: "/requests/pending",
  steps: [
    {
      title: "Pending requests ⏳",
      description:
        "This page gathers everything waiting for your yes or no — record deletions, employee requests, and access requests, all in one list. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="requests-pending-panel"]',
      title: "The pending queue",
      description:
        "One card holding every item that needs a decision. When it's empty, you're all caught up — nothing is waiting on you.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-pending-table"]',
      title: "The list of items",
      description:
        "Each row is one thing to decide on. The coloured tag shows the type — a deletion, a request, or an access ask — plus who sent it and when.",
      side: "top",
      align: "start",
    },
    {
      title: "Approve or deny",
      description:
        "On the right of each row are the action buttons. 'Approve' lets it go ahead; 'Deny' stops it. " +
        "For plain requests, 'View' opens the full details first. Try to clear this list daily so nobody is left waiting.",
      side: "top",
      align: "end",
    },
  ],
};
