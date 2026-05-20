import type { Tour } from "./types";

/**
 * Workflow tour: "Open and close the cash drawer".
 *
 * Covers the full daily till routine — opening in the morning, recording
 * movements during the day, and closing at night.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const cashSessionWorkflowTour: Tour = {
  id: "workflow-cash-session-v1",
  kind: "workflow",
  label: "Open and close the cash drawer",
  description: "The daily till routine — open in the morning, close at night.",
  estimatedMinutes: 6,
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
      title: "Let's run the cash drawer",
      description:
        "Every day the cash drawer is opened in the morning and closed at night. " +
        "I'll show you both — and how to log money in between. Hit 'Next' to start.",
    },
    {
      navigateTo: "/cash",
      element: '[data-tour-id="nav-cash"]',
      title: "Open the Cash Register",
      description:
        "This is the cash register page. Everything to do with the till lives here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="cash-open-session-button"]',
      title: "Open today's session",
      description:
        "In the morning, the first thing you do is open a session. " +
        "Click 'Open today's session' to start.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cash-open-session-opening-input"]',
      title: "Count the cash you start with",
      description:
        "Count the money already in the drawer and type that amount here. " +
        "This is your starting point for the day.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="cash-open-session-submit"]',
      title: "Start the session",
      description:
        "Click 'Open session'. The drawer is now open — the system is tracking every cash move.",
      side: "top",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cash-today-session-panel"]',
      title: "Today's session",
      description:
        "This card shows the live state of the drawer — opening balance, money in, money out, " +
        "and what should be there right now.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="cash-add-movement-button"]',
      title: "Log money during the day",
      description:
        "Whenever cash comes in or goes out — a payment, a refund, an expense — click " +
        "'Add movement' to record it. Click it now to see how.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cash-movement-amount-input"]',
      title: "Enter the amount",
      description:
        "Type how much cash moved. Pick whether it's money in or money out, and add a note.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="cash-movement-submit"]',
      title: "Record the movement",
      description:
        "Click 'Record'. The amount is added to the session and the running total updates.",
      side: "top",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cash-close-session-button"]',
      title: "End of day — close the drawer",
      description:
        "At night, you close the session. Click 'Close session' when the day is done.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cash-close-actual-input"]',
      title: "Count the cash you end with",
      description:
        "Count every note and coin in the drawer and type the total here. " +
        "The system checks it against what should be there.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="cash-close-submit"]',
      title: "Close the session",
      description:
        "Click 'Close session'. If your count matches, great. If not, you'll see the difference " +
        "so you can investigate.",
      side: "top",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cash-history-panel"]',
      title: "Past sessions",
      description:
        "Every closed day is saved here. Open any session to see what happened " +
        "and whether the cash balanced.",
      side: "top",
      align: "start",
    },
    {
      title: "Cash drawer done!",
      description:
        "That's the full daily routine — open, log, close. Do this every day and your " +
        "cash records will always be clean.",
    },
  ],
};
