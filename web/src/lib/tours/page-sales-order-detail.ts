import type { Tour } from "./types";

/**
 * Page tour: /sales-orders/[id] (Sales Order detail).
 *
 * Short walkthrough of a single sales order and its lifecycle. Tone matches
 * the owner welcome tour: short, plain English, no jargon.
 */
export const salesOrderDetailPageTour: Tour = {
  id: "page-sales-order-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the sales order page.",
  page: "/sales-orders/[id]",
  steps: [
    {
      element: '[data-tour-id="sales-order-detail-stepper"]',
      title: "The lifecycle steps",
      description:
        "A sale moves through stages — quote, accepted, deposit, contract, delivered. This bar shows how far along this deal is.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-order-detail-save-quote"]',
      title: "Send the quote",
      description:
        "Type the price you're offering, then click here to record the quote. This is the first real step of the sale.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-order-detail-save-deposit"]',
      title: "Record the deposit",
      description:
        "When the customer pays a deposit to hold the car, enter the amount and click here. The order moves to 'reserved'.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-order-detail-void-button"]',
      title: "Void the sale",
      description:
        "Owner-only. Cancels the whole sale, returns the car to inventory, and resets the customer. Use it for returns or mistakes.",
      side: "top",
      align: "start",
    },
  ],
};
