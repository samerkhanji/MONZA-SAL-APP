import type { Tour } from "./types";

/**
 * Page tour: /dashboard (the home page everyone lands on).
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * One step per meaningful thing on the page.
 *
 * Selectors reference `data-tour-id` attributes on the dashboard page —
 * see SELECTORS.md for the contract.
 */
export const dashboardPageTour: Tour = {
  id: "page-dashboard-v1",
  kind: "page",
  label: "Tour: This page",
  description: "A quick walk through your home dashboard.",
  page: "/dashboard",
  steps: [
    {
      title: "Your home page 🏠",
      description:
        "This is the first screen you see every day. It gives you the big picture of the dealership in one glance. " +
        "Let me point at each part — hit 'Next' to begin.",
    },
    {
      element: '[data-tour-id="dashboard-kpi-cards"]',
      title: "The big numbers",
      description:
        "These tiles are your headline numbers: how many cars you own, how many are in the garage, how many leads and customers you have, how many jobs are being worked on, and how many requests are waiting. " +
        "Click any tile to jump straight to that part of the app.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="dashboard-cars-by-status-panel"]',
      title: "Cars by status",
      description:
        "This shows your cars split into groups — new arrivals, ready to sell, reserved, and sold. " +
        "Click a row to see just those cars. It's a fast way to answer 'what do I have to sell right now?'",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="dashboard-low-stock-panel"]',
      title: "Low stock alerts",
      description:
        "When a garage part is running low or has run out, it shows up here in orange or red. " +
        "Click a part to go order more before a mechanic gets stuck waiting for it.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour-id="dashboard-garage-overview-panel"]',
      title: "Garage overview",
      description:
        "A snapshot of the service bays: how many jobs are pending, in progress, or done, plus the most recent jobs. " +
        "Click any job to open it, or 'View All' to see the full garage board.",
      side: "left",
      align: "start",
    },
    {
      title: "That's your dashboard! ✅",
      description:
        "Check this page first thing each morning. If a number looks off, click into it to dig deeper. " +
        "You can replay this tour anytime from your profile menu in the top-right corner.",
    },
  ],
};
