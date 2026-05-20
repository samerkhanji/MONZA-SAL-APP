import type { Tour } from "./types";

/**
 * Workflow tour: "Receive parts against a purchase order (GRN)".
 *
 * GRN = Goods Received Note. When parts physically arrive from a supplier,
 * you log a GRN against the purchase order so stock is updated.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const receivePartsWorkflowTour: Tour = {
  id: "workflow-receive-parts-v1",
  kind: "workflow",
  label: "Receive parts (GRN)",
  description: "Log parts arriving from a supplier against a purchase order.",
  estimatedMinutes: 5,
  allowedRoles: [
    "owner",
    "garage_manager",
    "garage_staff",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's receive some parts",
      description:
        "A delivery of parts just arrived from a supplier. " +
        "You log it against the purchase order so your stock count stays right. " +
        "This is called a GRN — a Goods Received Note. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage/purchase-orders",
      element: '[data-tour-id="nav-purchase-orders"]',
      title: "Open Purchase Orders",
      description:
        "Purchase orders are the orders you sent to suppliers. " +
        "We start here to find the order the parts belong to.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-status-tabs"]',
      title: "Find sent orders",
      description:
        "These tabs sort orders by stage. The parts you received belong to an order " +
        "that was already sent to the supplier — look in the 'Sent' or 'Approved' tab.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-search"]',
      title: "Search for the order",
      description:
        "Type the PO number or the supplier's name to find the right purchase order quickly.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="purchase-orders-table"]',
      title: "Open the order",
      description:
        "Click the purchase order's row in this table to open it. " +
        "That's where you log the receipt.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="po-detail-lines"]',
      title: "Check what was ordered",
      description:
        "This section lists every part on the order and how many were ordered. " +
        "Compare it against what actually showed up in the box.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="po-detail-log-grn"]',
      title: "Click 'Log GRN (receipt)'",
      description:
        "Click this button to record the delivery. It opens the receipt form.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Fill in the receipt",
      description:
        "In the receipt form, type how many of each part actually arrived. " +
        "If the supplier sent fewer than ordered, enter the real number — " +
        "the order stays open for the rest. Add the GRN number if you have one.",
    },
    {
      title: "Save the GRN",
      description:
        "Save the receipt. Two things happen: the parts are added to your inventory stock, " +
        "and the purchase order shows what's been received.",
    },
    {
      element: '[data-tour-id="po-detail-money"]',
      title: "Money side of the order",
      description:
        "Once the goods are in, this section handles the bill — attaching the supplier's " +
        "invoice and recording payment. That keeps the order fully accounted for.",
      side: "top",
      align: "start",
    },
    {
      title: "Parts received!",
      description:
        "Done. The parts are in stock, the purchase order is updated, and your mechanics " +
        "can use them on jobs. Repeat this for every delivery.",
    },
  ],
};
