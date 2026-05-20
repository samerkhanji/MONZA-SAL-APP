import type { Tour } from "./types";

/**
 * Page tour: /garage/refunds/[id] (one refund).
 *
 * Plain-English walkthrough of a single refund. A "refund" is money going
 * back to a customer.
 */
export const garageRefundDetailPageTour: Tour = {
  id: "page-garage-refund-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through a single refund's page.",
  page: "/garage/refunds/[id]",
  steps: [
    {
      element: '[data-tour-id="refund-detail-back"]',
      title: "Back to all refunds",
      description:
        "Takes you back to the full list of refunds when you're done here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="refund-detail-summary"]',
      title: "Refund details",
      description:
        "All the facts of this refund: the customer, whether it's for a part or a service, the amount, the reason, and any linked job. This is the heart of the page.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="refund-detail-actions"]',
      title: "Action buttons",
      description:
        "What you can do with this refund right now. While it's waiting you can Approve or Reject it; once approved you can mark it Paid; and you can Cancel a request that's no longer needed. Which buttons show depends on the stage and on what you're allowed to do.",
      side: "top",
      align: "start",
    },
  ],
};
