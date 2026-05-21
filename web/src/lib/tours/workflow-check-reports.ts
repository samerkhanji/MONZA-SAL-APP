import type { Tour } from "./types";

/**
 * Workflow tour: "Read the Reports page".
 *
 * Understanding the numbers — profit, sales rep performance, aging stock,
 * money owed, and garage timing.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const checkReportsWorkflowTour: Tour = {
  id: "workflow-check-reports-v1",
  kind: "workflow",
  label: "Read the Reports page",
  description: "Understand the numbers — profit, sales, stock age, and money owed.",
  estimatedMinutes: 4,
  steps: [
    {
      title: "Let's read the reports",
      description:
        "The Reports page turns the business into numbers you can act on. " +
        "I'll walk you through each card and what it tells you. Hit 'Next' to start.",
    },
    {
      navigateTo: "/reports",
      element: '[data-tour-id="nav-reports"]',
      title: "Open Reports",
      description:
        "This is the Reports page. Everything here is built from your real data — " +
        "no need to fill anything in.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-summary-tiles"]',
      title: "The top-line numbers",
      description:
        "These tiles are the quick summary — the headline figures at a glance. " +
        "Start here for the overall picture before digging in.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-margin-panel"]',
      title: "Profit per sale",
      description:
        "This card shows how much profit each delivered car made. " +
        "It's the difference between what you paid and what you sold it for.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-sales-rep-panel"]',
      title: "Sales rep performance",
      description:
        "This card shows how each salesperson is doing — how much they've sold. " +
        "Use it to see who needs help and who's doing well.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-inventory-aging-panel"]',
      title: "Inventory aging",
      description:
        "This card shows how long cars have been sitting unsold. " +
        "Cars that have been on the lot a long time may need a price review.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-aged-receivables-panel"]',
      title: "Money owed to you",
      description:
        "This card lists money customers still owe and how overdue it is. " +
        "The older the debt, the sooner you should follow it up.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-time-state-panel"]',
      title: "Garage timing",
      description:
        "This card shows how long jobs spend at each stage in the garage. " +
        "If jobs sit too long in one stage, that's where the workshop is getting stuck.",
      side: "top",
      align: "start",
    },
    {
      title: "Reports understood!",
      description:
        "Done. You now know what each card means. " +
        "Check Reports regularly — it's how you spot problems before they get big.",
    },
  ],
};
