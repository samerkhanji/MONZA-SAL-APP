import type { Tour } from "./types";

/**
 * Workflow tour: "Find and reorder low-stock parts".
 *
 * Spotting parts that are running low and ordering more before you run out.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const manageLowStockWorkflowTour: Tour = {
  id: "workflow-manage-low-stock-v1",
  kind: "workflow",
  label: "Reorder low-stock parts",
  description: "Find parts that are running low and order more before you run out.",
  estimatedMinutes: 4,
  allowedRoles: [
    "owner",
    "garage_manager",
    "garage_staff",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's check on low stock",
      description:
        "Parts run out. If you wait too long, a job stalls because the part isn't on the shelf. " +
        "This tour shows you how to spot low stock early and reorder. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage/inventory",
      element: '[data-tour-id="nav-parts"]',
      title: "Open the Inventory",
      description:
        "This is your parts inventory — every part you keep in stock is listed here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-low-stock-banner"]',
      title: "The low-stock warning",
      description:
        "When parts are running low, this banner appears at the top. " +
        "It tells you straight away that something needs reordering. If it's not showing, your stock is fine.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-status-filter"]',
      title: "Filter to just low stock",
      description:
        "Use this filter to show only the parts that are low or out of stock. " +
        "Now your list is exactly the parts that need attention.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-search"]',
      title: "Search for a part",
      description:
        "If you're looking for one specific part, type its name or number here to find it fast.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="inventory-table"]',
      title: "Check the stock levels",
      description:
        "This table shows how many of each part you have. " +
        "A part below its minimum level is the one to reorder.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-row-actions"]',
      title: "Open a part's actions",
      description:
        "Click this menu on a part's row to see what you can do — view it, edit it, or check details " +
        "before deciding how many to order.",
      side: "left",
      align: "start",
    },
    {
      title: "Order more",
      description:
        "To restock, create a purchase order for the supplier of that part. " +
        "Order enough to cover the next few weeks — but don't over-order parts you rarely use.",
    },
    {
      navigateTo: "/garage/purchase-orders",
      element: '[data-tour-id="purchase-orders-new"]',
      title: "Start the purchase order",
      description:
        "Click 'New PO' to begin the order. Add the low-stock parts to it, then send it to the supplier.",
      side: "bottom",
      align: "end",
    },
    {
      title: "Low stock handled!",
      description:
        "Done. You spotted the low parts and put an order in. " +
        "Check the low-stock banner often — catching it early keeps the workshop running.",
    },
  ],
};
