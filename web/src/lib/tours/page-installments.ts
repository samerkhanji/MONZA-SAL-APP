import type { Tour } from "./types";

/**
 * Page tour: /installments.
 *
 * Walks through the payment-plan tabs and the "mark paid" flow. Tone matches
 * the owner welcome tour: short, plain English, no jargon.
 */
export const installmentsPageTour: Tour = {
  id: "page-installments-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Installments page.",
  page: "/installments",
  steps: [
    {
      element: '[data-tour-id="installments-new-plan-button"]',
      title: "New payment plan",
      description:
        "When a customer agrees to pay for a car in monthly pieces, click here to set up the plan — amount, number of months, start date.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="installments-tabs"]',
      title: "The four tabs",
      description:
        "These switch what you're looking at: Due (money owed now), Upcoming (coming soon), Paid (already collected), and Plans (every plan).",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="installments-due-row-mark-paid"]',
      title: "Mark Paid",
      description:
        "When a customer hands over a payment, click this on their row to record it. It opens a small form to confirm the details.",
      side: "left",
      align: "center",
    },
    {
      element: '[data-tour-id="installments-mark-paid-dialog"]',
      title: "The payment form",
      description:
        "This window shows who's paying and how much is due. Fill it in to log the payment.",
      side: "over",
      align: "center",
    },
    {
      element: '[data-tour-id="installments-mark-paid-amount-input"]',
      title: "Amount paid",
      description:
        "Type how much the customer actually paid. If it's less, the system marks it 'partial'; if it's more, the extra becomes account credit.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="installments-mark-paid-method-select"]',
      title: "Payment method",
      description:
        "Pick how the money came in — cash, bank transfer, check, or card. This keeps your records accurate.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="installments-mark-paid-cancel"]',
      title: "Cancel",
      description:
        "Close this window without saving. Use it if you opened it by mistake or aren't ready yet.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="installments-mark-paid-confirm"]',
      title: "Confirm Paid",
      description:
        "Saves the payment and updates the plan. Once you click this, the installment is recorded as collected.",
      side: "top",
      align: "end",
    },
  ],
};
