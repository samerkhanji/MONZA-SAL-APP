import type { Tour } from "./types";

/**
 * Page tour: /reports.
 *
 * The reports page — your numbers turned into tables: sales-rep performance,
 * how long cars sit in stock, who owes you money, and how fast the garage works.
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
        "Three quick numbers at the top: how many cars are in stock, how much money customers still owe, and the average time a garage job takes.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-sales-rep-panel"]',
      title: "Sales rep performance",
      description:
        "Each salesperson's numbers side by side — deals in progress, deals delivered, and how fast they close. " +
        "Use it to see who's doing well and who needs help.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-inventory-aging-panel"]',
      title: "Inventory aging",
      description:
        "This section shows how long unsold cars have been sitting in stock. A car in the 90–180 day bucket should trigger a pricing review and proactive sales outreach. A car crossing into >180 days should be discussed with the owner immediately. Holding unsold inventory for more than 6 months significantly impacts company liquidity.",
      type: "section",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="reports-aging-bucket-90-180"]',
      title: "The 90–180 day bucket",
      description:
        "Cars here arrived months ago and still haven't sold. Treat this bucket as your action list: review pricing and call warm leads. Anything that slips past 180 days (the red tile) needs an owner conversation.",
      type: "warning",
      side: "bottom",
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
