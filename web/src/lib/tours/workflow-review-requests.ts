import type { Tour } from "./types";

/**
 * Workflow tour: "Review and decide on requests".
 *
 * Going through requests waiting for a decision and approving or rejecting
 * them.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const reviewRequestsWorkflowTour: Tour = {
  id: "workflow-review-requests-v1",
  kind: "workflow",
  label: "Review and decide requests",
  description: "Go through pending requests and approve or reject them.",
  estimatedMinutes: 4,
  steps: [
    {
      title: "Let's review some requests",
      description:
        "People raise requests that need a yes or no from you. " +
        "This tour shows you how to find them and make the decision. Hit 'Next' to start.",
    },
    {
      navigateTo: "/requests/pending",
      element: '[data-tour-id="nav-requests"]',
      title: "Open Requests",
      description:
        "Requests live under this menu item. We're starting on the pending list — " +
        "the requests still waiting on you.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-pending-panel"]',
      title: "The pending list",
      description:
        "This card shows every request waiting for a decision. " +
        "If it's empty, you're all caught up — nothing needs you right now.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-pending-table"]',
      title: "Pick a request to review",
      description:
        "Each row is one request. Click a row to open it and read the full details before you decide.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      navigateTo: "/requests",
      element: '[data-tour-id="requests-filter-priority"]',
      title: "Sort by priority",
      description:
        "On the full Requests page, this filter sorts by priority. " +
        "Deal with the high-priority ones first.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-table"]',
      title: "Open a request",
      description:
        "Click any request's row to open its detail window.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="requests-detail-dialog"]',
      title: "Read it carefully",
      description:
        "This window shows the full request — what's being asked and why. " +
        "Read all of it before deciding. Don't approve something you don't fully understand.",
      side: "over",
      align: "center",
    },
    {
      title: "Approve or reject",
      description:
        "Inside the request, use the approve or reject buttons. " +
        "If you reject, write a short reason — the person needs to know why so they can fix it or move on.",
    },
    {
      title: "Requests reviewed!",
      description:
        "Done. Each request now has a clear decision and the person who raised it is notified. " +
        "Check the pending list often so nobody is left waiting.",
    },
  ],
};
