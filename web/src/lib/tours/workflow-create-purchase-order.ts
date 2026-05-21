import type { Tour } from "./types";

/**
 * Workflow tour: "Create a purchase order for parts".
 *
 * Ordering parts from a supplier — from drafting the PO to sending it.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const createPurchaseOrderWorkflowTour: Tour = {
  id: "workflow-create-purchase-order-v1",
  kind: "workflow",
  label: "Create a purchase order",
  description: "Order parts from a supplier with a new purchase order.",
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
      title: "Let's order some parts",
      description:
        "When you need parts from a supplier, you make a purchase order — a PO. " +
        "It lists what you want, who it's from, and tracks it until the parts arrive. " +
        "I'll show you how. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage/purchase-orders",
      element: '[data-tour-id="nav-purchase-orders"]',
      title: "Open Purchase Orders",
      description:
        "This is the purchase orders page. Every order to a supplier lives here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-status-tabs"]',
      title: "Orders by stage",
      description:
        "These tabs sort orders by stage — draft, pending, approved, sent. " +
        "A brand new order starts as a draft.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="purchase-orders-new"]',
      title: "Click 'New PO'",
      description:
        "Click 'New PO' to start a new order. This opens the order form.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="purchase-orders-new-dialog"]',
      title: "Choose the supplier",
      description:
        "In this window, pick the supplier you're ordering from. " +
        "If the supplier isn't listed yet, add them on the Suppliers page first.",
      side: "over",
      align: "center",
    },
    {
      title: "Create the order",
      description:
        "Submit the form to create the order. It opens as a draft, ready for you to add parts.",
    },
    {
      element: '[data-tour-id="po-detail-lines"]',
      title: "Add the parts you need",
      description:
        "This section is the shopping list. Add each part you want and how many. " +
        "Be accurate — this is exactly what the supplier will send.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="po-detail-actions"]',
      title: "The order actions",
      description:
        "This card holds the buttons that move the order forward — approving it and sending it.",
      side: "top",
      align: "start",
    },
    {
      title: "Send to supplier",
      description:
        "Once the order is approved, use the 'Send to supplier' button in the actions card. " +
        "Avoid this mistake: check the parts and amounts before sending — once it's sent, the supplier acts on it.",
    },
    {
      title: "Purchase order created!",
      description:
        "Done. The order is on its way to the supplier. " +
        "When the parts arrive, you'll log a GRN (receipt) on this same order to add them to stock.",
    },
  ],
};
