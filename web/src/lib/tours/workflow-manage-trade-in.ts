import type { Tour } from "./types";

/**
 * Workflow tour: "Review and approve a trade-in".
 *
 * A customer trades in their old car. This tour follows the trade-in from
 * inspection through to the owner's decision.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const manageTradeInWorkflowTour: Tour = {
  id: "workflow-manage-trade-in-v1",
  kind: "workflow",
  label: "Review a trade-in",
  description: "Inspect a customer's trade-in car and approve or reject it.",
  estimatedMinutes: 5,
  allowedRoles: [
    "owner",
    "sales",
    "hybrid",
    "khalil_hybrid",
    "sales_ops",
  ],
  steps: [
    {
      title: "Let's handle a trade-in",
      description:
        "A customer wants to trade in their old car towards a new one. " +
        "First it's inspected, then the owner approves a value. I'll show you the steps. Hit 'Next' to start.",
    },
    {
      navigateTo: "/trade-ins",
      element: '[data-tour-id="nav-trade-ins"]',
      title: "Open Trade-ins",
      description:
        "This is the trade-ins page. Every car a customer offers to trade in is tracked here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-list-status-tabs"]',
      title: "Trade-ins by stage",
      description:
        "These tabs sort trade-ins by stage — provisional, inspecting, inspected, approved, and so on. " +
        "It helps you find which ones need action.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-list-search-input"]',
      title: "Find the trade-in",
      description:
        "Type the customer name or car details here to jump to the trade-in you want to review.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      title: "Open the trade-in",
      description:
        "Click the trade-in's row in the list to open its full detail page. " +
        "That's where you inspect it and make the decision.",
    },
    {
      element: '[data-tour-id="trade-in-detail-start-inspection"]',
      title: "Start the inspection",
      description:
        "Click 'Start inspection' to begin checking the car. " +
        "This marks the trade-in as being looked at right now.",
      side: "bottom",
      align: "start",
    },
    {
      title: "Complete the inspection",
      description:
        "Look the car over — condition, mileage, any damage. Then use the 'Complete inspection' button " +
        "to record what you found and the value you think it's worth.",
    },
    {
      title: "Owner reviews it",
      description:
        "Once inspected, the owner sees the trade-in and the suggested value. " +
        "Only the owner can approve or reject it.",
    },
    {
      title: "Approve or reject",
      description:
        "If the value is fair, the owner clicks 'Approve' and confirms the accepted amount. " +
        "If not, they click 'Reject'. Avoid this mistake: never promise the customer a final price " +
        "before the owner has approved it.",
    },
    {
      title: "Commit to a sale",
      description:
        "After it's approved, use 'Commit to sales order' to link the trade-in value to the customer's " +
        "new car purchase. The trade-in amount comes off their bill.",
    },
    {
      title: "Trade-in done!",
      description:
        "Done. The old car was inspected, valued, approved, and applied to the sale. " +
        "The customer gets fair credit and your records stay accurate.",
    },
  ],
};
