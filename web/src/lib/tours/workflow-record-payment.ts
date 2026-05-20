import type { Tour } from "./types";

/**
 * Workflow tour: "Record an installment payment".
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const recordPaymentWorkflowTour: Tour = {
  id: "workflow-record-payment-v1",
  kind: "workflow",
  label: "Record an installment payment",
  description: "Mark a monthly installment as paid when the money comes in.",
  estimatedMinutes: 3,
  allowedRoles: [
    "owner",
    "assistant",
    "sales",
    "sales_ops",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's record a payment",
      description:
        "A customer who's paying in monthly installments just paid you. " +
        "I'll show you how to mark that payment in the system. Hit 'Next' to start.",
    },
    {
      navigateTo: "/installments",
      element: '[data-tour-id="nav-installments"]',
      title: "Open Installments",
      description:
        "This page tracks every customer who pays in monthly pieces — " +
        "what's due, what's late, and what's already paid.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="installments-tabs"]',
      title: "The payment tabs",
      description:
        "These tabs split payments up: 'Due' is owed now, 'Upcoming' is coming soon, " +
        "'Paid' is done. Make sure you're on the 'Due' tab to find the payment you just received.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="installments-due-row-mark-paid"]',
      title: "Click 'Mark Paid'",
      description:
        "Find the customer's row in the Due list and click its 'Mark Paid' button. " +
        "This opens the payment window.",
      side: "left",
      align: "center",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="installments-mark-paid-amount-input"]',
      title: "Enter the amount paid",
      description:
        "Type how much the customer actually handed over. It's usually the full installment, " +
        "but you can record a partial payment too.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="installments-mark-paid-method-select"]',
      title: "How did they pay?",
      description:
        "Pick the payment method — cash, card, bank transfer. " +
        "If it was cash, it also shows up in the cash drawer.",
      side: "right",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="installments-mark-paid-confirm"]',
      title: "Confirm the payment",
      description:
        "Click 'Confirm Paid'. The installment moves to the 'Paid' tab and the customer's " +
        "balance goes down.",
      side: "top",
      align: "end",
      waitFor: "click",
    },
    {
      title: "Payment recorded!",
      description:
        "Done. The payment is logged, the customer owes less, and your reports stay accurate. " +
        "Repeat this each time an installment is paid.",
    },
  ],
};
