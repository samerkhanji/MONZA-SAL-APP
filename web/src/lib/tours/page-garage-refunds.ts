import type { Tour } from "./types";

/**
 * Page tour: /garage/refunds.
 *
 * Plain-English walkthrough of the refunds list. A "refund" is money going
 * back to a customer — for example if a part was faulty or they were charged
 * too much.
 */
export const garageRefundsPageTour: Tour = {
  id: "page-garage-refunds-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Refunds page.",
  page: "/garage/refunds",
  steps: [
    {
      element: '[data-tour-id="refunds-request"]',
      title: "Request refund",
      description:
        "Click here when a customer should get money back. You pick the customer, the amount, and why. Big refunds need the owner to say yes before the money is paid.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="refunds-status-tabs"]',
      title: "Status tabs",
      description:
        "Each tab shows refunds at one stage — waiting for approval, approved, paid, or rejected. Click a tab to see only those. The number shows how many.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="refunds-search"]',
      title: "Search box",
      description:
        "Type a refund number, a customer name, or the reason to find one refund fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="refunds-table"]',
      title: "The refunds list",
      description:
        "Every refund, newest first. It shows the customer, the amount, who needs to approve it, and the stage it's at. Click any row to open the full refund.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="refunds-request-dialog"]',
      title: "The refund-request form",
      description:
        "This window asks whether it's for a part or a service, the customer, the amount, and the reason. The system works out who needs to approve it from the amount. Fill it in and press 'Submit refund request'.",
      side: "over",
      align: "center",
    },
  ],
};
