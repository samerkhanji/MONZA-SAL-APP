import type { Tour } from "./types";

/**
 * Page tour: /garage/purchase-orders/[id] (one purchase order).
 *
 * Plain-English walkthrough of a single purchase order — the order form you
 * send a supplier to buy parts. A "GRN" is the slip you sign when the parts
 * arrive.
 */
export const garagePurchaseOrderDetailPageTour: Tour = {
  id: "page-garage-purchase-order-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through a single purchase order's page.",
  page: "/garage/purchase-orders/[id]",
  steps: [
    {
      element: '[data-tour-id="po-detail-back"]',
      title: "Back to all purchase orders",
      description:
        "Takes you back to the full list of orders when you're done here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="po-detail-lines"]',
      title: "Line items",
      description:
        "Every part on this order, with the quantity and price. While the order is still a draft you can add or remove lines here. The 'Received' column shows how much has actually arrived.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="po-detail-actions"]',
      title: "Action buttons",
      description:
        "What you can do with this order right now. Depending on the stage you might submit it for approval, approve it, send it to the supplier, or cancel it. Only the buttons that make sense at this stage are shown.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="po-detail-log-grn"]',
      title: "Log GRN (receipt)",
      description:
        "When the parts arrive, click here to record what you actually received. A GRN is the slip you fill in when goods come in — and only this step adds the parts to your stock.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="po-detail-money"]',
      title: "Money",
      description:
        "Once the supplier sends a bill, their invoices and your payments show up here, so you can see how much was billed and how much is paid.",
      side: "top",
      align: "start",
    },
  ],
};
