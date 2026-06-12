import type { Tour } from "./types";

/**
 * Page tour: /sales-orders (Sales Orders list).
 *
 * Walks through the order list, its top numbers, search, and status filter.
 * Tone matches the owner welcome tour: short, plain English, no jargon.
 */
export const salesOrdersPageTour: Tour = {
  id: "page-sales-orders-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Sales Orders page.",
  page: "/sales-orders",
  steps: [
    {
      element: '[data-tour-id="sales-orders-list-kpi-bar"]',
      title: "Your order numbers",
      description:
        "Three quick totals — how many orders you have, how many are still in progress, and the money they add up to. A fast health check.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-orders-list-refresh-button"]',
      title: "Refresh",
      description:
        "Click this to pull the newest orders. Handy if a teammate just created one and you want it to show up.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="sales-orders-list-table-panel"]',
      title: "All orders",
      description:
        "Every car sale, one per row — car, customer, and status. Click a row to open the full order and walk it through to delivery.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-orders-list-search-input"]',
      title: "Search box",
      description:
        "Type a VIN, car name, customer name, or phone number to find one order fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-orders-list-filter-status"]',
      title: "Filter by status",
      description:
        "Show only orders at one stage — draft, reserved, confirmed, paid, delivered, or cancelled. Great for seeing what still needs work.",
      side: "bottom",
      align: "start",
    },
  ],
};
