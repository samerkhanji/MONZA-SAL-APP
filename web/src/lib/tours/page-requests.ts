import type { Tour } from "./types";

/**
 * Page tour: /requests (the Request Center).
 *
 * A "request" is when an employee asks permission for something — a refund,
 * an unusual action, deleting a record. This page is where they're created,
 * tracked, and approved.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const requestsPageTour: Tour = {
  id: "page-requests-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Request Center.",
  page: "/requests",
  steps: [
    {
      title: "The Request Center 📨",
      description:
        "A 'request' is when someone on the team asks permission for something — a refund, an unusual action, anything that needs a yes from above. " +
        "This page is where every request lives. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="requests-new-button"]',
      title: "New Request button",
      description:
        "Need to ask for something yourself? Click here. A form opens where you write what you need and choose who should approve it.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="requests-filter-status"]',
      title: "Status filter",
      description:
        "Show only requests at a certain stage — submitted, waiting for approval, approved, or rejected. " +
        "Set it to 'Awaiting approval' to see what needs your decision.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-filter-priority"]',
      title: "Priority filter",
      description:
        "Filter by how urgent requests are — green is low, yellow is medium, red is urgent. Use it to find the ones that can't wait.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-search-input"]',
      title: "Search",
      description:
        "Type a word from a request's subject, its description, or the name of the person who sent it to find it fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-table"]',
      title: "The requests list",
      description:
        "Every request, one per row — who sent it, who it's for, how urgent it is, and where it stands. " +
        "Click any row to open the full details.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-new-dialog"]',
      title: "The new request form",
      description:
        "This pops up when you click 'New Request'. Fill in a clear subject, add a description, pick a priority, and choose who to send it to. " +
        "An optional VIN links it to a specific car.",
      side: "over",
      align: "center",
    },
    {
      element: '[data-tour-id="requests-detail-dialog"]',
      title: "The request details",
      description:
        "Click a row and this opens. You'll see the full request and, depending on your role, buttons to approve it, reject it, or ask for more information.",
      side: "over",
      align: "center",
    },
    {
      title: "That's the Request Center! ✅",
      description:
        "Check it regularly so nobody is left waiting on a decision. Replay this guide anytime from the ? button in the bottom-right corner.",
    },
  ],
};
