import type { Tour } from "./types";

/**
 * Workflow tour: "Request and approve a refund".
 *
 * Covers both halves: anyone requests a refund, then an owner approves it
 * and marks it paid.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const processRefundWorkflowTour: Tour = {
  id: "workflow-process-refund-v1",
  kind: "workflow",
  label: "Request and approve a refund",
  description: "Raise a refund for a customer, then approve and pay it.",
  estimatedMinutes: 5,
  allowedRoles: [
    "owner",
    "garage_manager",
    "garage_staff",
    "assistant",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's handle a refund",
      description:
        "Sometimes you need to give a customer money back. " +
        "First someone requests the refund, then the owner approves and pays it. " +
        "I'll show you both. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage/refunds",
      element: '[data-tour-id="nav-refunds"]',
      title: "Open Refunds",
      description:
        "This is the refunds page. Every refund — requested, approved, or paid — is tracked here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="refunds-request"]',
      title: "Click 'Request refund'",
      description:
        "To start a refund, click 'Request refund'. This opens the request form.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="refunds-request-dialog"]',
      title: "Fill in the request",
      description:
        "Pick the customer, type the amount to refund, and write the reason. " +
        "If it's linked to a garage job, add the job. Then submit the request.",
      side: "over",
      align: "center",
    },
    {
      title: "Submit the request",
      description:
        "Click the submit button in the form. The refund is now created and waiting " +
        "for an owner to approve it.",
    },
    {
      element: '[data-tour-id="refunds-status-tabs"]',
      title: "Find the pending refund",
      description:
        "These tabs sort refunds by stage. A new request sits in the 'Pending' or " +
        "'Requested' tab, waiting for a decision.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="refunds-table"]',
      title: "Open the refund",
      description:
        "Click the refund's row to open it. The owner reviews and decides from here.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="refund-detail-summary"]',
      title: "Review the details",
      description:
        "Check the customer, the amount, and the reason before deciding. " +
        "Make sure the refund is genuine.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="refund-detail-approve"]',
      title: "Approve it",
      description:
        "If the refund is fair, the owner clicks 'Approve'. " +
        "(If not, there's a 'Reject' button right next to it.)",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="refund-detail-pay"]',
      title: "Mark it paid",
      description:
        "Once approved and the money has actually gone back to the customer, " +
        "click 'Mark as paid'. This closes the refund.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Refund complete!",
      description:
        "Done. The refund was requested, approved, and paid — all recorded. " +
        "The customer got their money back and your books stay accurate.",
    },
  ],
};
