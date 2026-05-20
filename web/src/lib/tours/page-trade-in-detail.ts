import type { Tour } from "./types";

/**
 * Page tour: /trade-ins/[id] (Trade-in detail).
 *
 * Short walkthrough of a single trade-in. Tone matches the owner welcome
 * tour: short, plain English, no jargon.
 *
 * Note: most action buttons on this page appear only at certain stages
 * (inspect, approve, reject, commit) and for certain roles. The tour
 * highlights the first step — "Start inspection" — which is the stable
 * entry point that the documented `data-tour-id` covers.
 */
export const tradeInDetailPageTour: Tour = {
  id: "page-trade-in-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the trade-in page.",
  page: "/trade-ins/[id]",
  steps: [
    {
      title: "This is a trade-in",
      description:
        "This page tracks one old car a customer wants to hand in. It moves through stages: requested, inspected, approved, then committed to a sale.",
    },
    {
      element: '[data-tour-id="trade-in-detail-start-inspection"]',
      title: "Start inspection",
      description:
        "When the garage is ready to check the car over, click here. It moves the trade-in from 'provisional' to 'inspecting'.",
      side: "top",
      align: "start",
    },
    {
      title: "What happens next",
      description:
        "After inspecting, the garage logs issues and a recommended value. The owner then approves a final price, and sales commits it to the customer's order — the credit comes off the new car automatically.",
    },
  ],
};
