import type { Tour } from "./types";

/**
 * Page tour: /dashboard/overview (the owner overview).
 *
 * The "owner overview" is the business-at-a-glance screen — only the owner
 * sees it. It answers "how is the whole business doing right now?" in one
 * scroll.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const overviewPageTour: Tour = {
  id: "page-overview-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the owner overview screen.",
  page: "/dashboard/overview",
  steps: [
    {
      title: "The owner overview 👀",
      description:
        "This page is just for you. It's the whole business on one screen — sales, cash, the garage, the fleet, and the waiting queue. " +
        "When you want the 30-second answer to 'how are we doing?', this is the page. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="overview-refresh-button"]',
      title: "Refresh button",
      description:
        "The numbers here are a snapshot. If you've just made a sale or taken a payment, click Refresh to pull the very latest figures.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="overview-kpi-strip"]',
      title: "The headline numbers",
      description:
        "Five tiles at the top: total vehicles, total customers, active sales orders, the pending approval queue, and warranties about to expire. " +
        "These are the numbers you'd quote if someone asked how big the business is.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="overview-sales-revenue-panel"]',
      title: "Sales this month",
      description:
        "How many cars you've delivered this month, and which sales rep is leading. " +
        "It also shows your sales pipeline — deals at each stage from quote to delivery.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="overview-cash-receivables-panel"]',
      title: "Cash & receivables",
      description:
        "Is the cash drawer open? How much money came in and went out today? " +
        "It also flags refunds waiting for your approval and customers who are late on payments.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="overview-fleet-logistics-panel"]',
      title: "Fleet logistics",
      description:
        "How long cars have been sitting in stock (cars over 90 days are flagged in orange), which reservations are coming up, and what arrived in the last week.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="overview-cars-by-status-panel"]',
      title: "Cars by status",
      description:
        "Your fleet split into groups — sold, available, reserved, inventory. " +
        "Use the small buttons in the corner to switch between bar, pie, donut, or line charts, whichever you find easiest to read.",
      side: "top",
      align: "start",
    },
    {
      title: "That's the owner overview! 🎉",
      description:
        "Scroll down for more — garage tasks, requests by urgency, installments due soon, and low stock parts. " +
        "Every panel has a link to dig into the details. Replay this guide anytime from the ? button in the bottom-right corner.",
    },
  ],
};
