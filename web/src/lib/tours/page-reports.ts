import type { Tour } from "./types";

/**
 * Page tour: /reports.
 *
 * The reports page — your numbers turned into tables: profit, sales-rep
 * performance, how long cars sit in stock, who owes you money, and how fast
 * the garage works.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const reportsPageTour: Tour = {
  id: "page-reports-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Reports page.",
  page: "/reports",
  steps: [
    {
      title: "Reports 📊",
      description:
        "This page turns your day-to-day data into clear numbers. Use it to spot what's making money, what's stuck, and who owes you. " +
        "Everything here is live from the database. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="reports-summary-tiles"]',
      title: "The headline tiles",
      description:
        "Four quick numbers at the top: total profit from delivered cars, how many cars are in stock, how much money customers still owe, and the average time a garage job takes.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-margin-panel"]',
      title: "Profit margin per sale",
      description:
        "For every car you've delivered: what it cost you, what you sold it for, and the profit in between. " +
        "This tells you which deals were actually worth it.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-sales-rep-panel"]',
      title: "Sales rep performance",
      description:
        "Each salesperson's numbers side by side — deals in progress, deals delivered, revenue, profit, and how fast they close. " +
        "Use it to see who's doing well and who needs help.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-inventory-aging-panel"]',
      title: "Inventory aging",
      description:
        "How long cars have been sitting unsold. Cars over 90 days are flagged — old stock ties up your money, so these are the ones to push.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-aged-receivables-panel"]',
      title: "Aged receivables",
      description:
        "Money customers still owe you, grouped by how late they are. " +
        "The further right a payment falls, the more overdue it is — chase those first.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-time-state-panel"]',
      title: "Garage time-in-state",
      description:
        "For finished jobs: how long each one spent waiting, being worked on, and waiting to be handed back. " +
        "It shows you where the garage slows down.",
      side: "top",
      align: "start",
    },
    {
      title: "That's the Reports page! ✅",
      description:
        "These numbers refresh every time you open the page. Replay this guide anytime from the ? button in the bottom-right corner.",
    },
  ],
};
