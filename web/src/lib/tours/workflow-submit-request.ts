import type { Tour } from "./types";

/**
 * Workflow tour: "Submit a request for approval".
 *
 * Raising a request — for a purchase, a discount, time off, anything that
 * needs a yes from someone above you.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const submitRequestWorkflowTour: Tour = {
  id: "workflow-submit-request-v1",
  kind: "workflow",
  label: "Submit a request",
  description: "Raise a request and send it for approval.",
  estimatedMinutes: 4,
  steps: [
    {
      title: "Let's submit a request",
      description:
        "Need a yes from someone above you — for a purchase, a discount, or anything else? " +
        "You raise a request. I'll show you how. Hit 'Next' to start.",
    },
    {
      navigateTo: "/requests",
      element: '[data-tour-id="nav-requests"]',
      title: "Open Requests",
      description:
        "This is the Requests page. Every request — yours and the team's — is tracked here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-new-button"]',
      title: "Click 'New Request'",
      description:
        "Click 'New Request' to start. This opens the request form.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="requests-new-dialog"]',
      title: "Fill in the request",
      description:
        "In this window, describe what you need and why. Be clear and specific — " +
        "the person approving needs to understand it without asking you.",
      side: "over",
      align: "center",
    },
    {
      title: "Set the priority",
      description:
        "Choose how urgent the request is. Mark something 'high' only when it really is — " +
        "if everything is urgent, nothing stands out.",
    },
    {
      element: '[data-tour-id="requests-new-submit"]',
      title: "Submit the request",
      description:
        "Click submit. The request is now sent and waiting for someone to approve or reject it.",
      side: "top",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="requests-filter-status"]',
      title: "Track your request",
      description:
        "Use this status filter to find your request later. " +
        "It will show 'pending' until someone makes a decision.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="requests-table"]',
      title: "See the decision",
      description:
        "Your request appears in this list. Click its row to open it and see if it was approved, " +
        "rejected, or is still waiting.",
      side: "top",
      align: "start",
    },
    {
      title: "Request submitted!",
      description:
        "Done. Your request is in the system and the right person has been notified. " +
        "Check back here for the decision — you don't need to chase anyone by phone.",
    },
  ],
};
