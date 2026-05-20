import type { Tour } from "./types";

/**
 * Page tour: /garage/purchase-orders.
 *
 * Plain-English walkthrough of the purchase orders list. A "purchase order"
 * (PO) is the order form you send to a supplier when you want to buy parts.
 * A "GRN" is the slip you sign when those parts actually arrive.
 */
export const garagePurchaseOrdersPageTour: Tour = {
  id: "page-garage-purchase-orders-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Purchase Orders page.",
  page: "/garage/purchase-orders",
  steps: [
    {
      element: '[data-tour-id="purchase-orders-new"]',
      title: "New PO",
      description:
        "Click here to start an order for parts. A purchase order is the form you send a supplier to ask for stock. It starts as a draft so you can add items before sending it.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="purchase-orders-status-tabs"]',
      title: "Status tabs",
      description:
        "Each tab shows orders at one stage of their life — draft, waiting for approval, approved, sent, received, paid, and so on. Click a tab to see just those. The small number tells you how many are in each.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-search"]',
      title: "Search box",
      description:
        "Type a PO number or a supplier name to jump straight to one order.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-table"]',
      title: "The orders list",
      description:
        "Every purchase order, newest first. It shows the supplier, the stage it's at, the estimated cost, and when parts are expected. Click any row to open that order and add or receive items.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-new-dialog"]',
      title: "The new-order form",
      description:
        "This window asks who you're buying from. Pick a supplier, add an optional note, and press 'Create draft' — then you'll add the actual parts on the next screen.",
      side: "over",
      align: "center",
    },
    {
      element: '[data-tour-id="purchase-orders-inventory-link"]',
      title: "Back to Parts inventory",
      description:
        "A shortcut back to the parts store, so you can check what you have before ordering more.",
      side: "top",
      align: "start",
    },
  ],
};
