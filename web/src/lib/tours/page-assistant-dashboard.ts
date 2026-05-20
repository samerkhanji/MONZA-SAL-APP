import type { Tour } from "./types";

/**
 * Page tour: /assistant-dashboard.
 *
 * The assistant dashboard is the home screen for the request assistant —
 * it surfaces what needs a human's attention: requests to review, cars ready
 * for pickup, the workshop, and repair quotes waiting on the customer.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const assistantDashboardPageTour: Tour = {
  id: "page-assistant-dashboard-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the assistant dashboard.",
  page: "/assistant-dashboard",
  steps: [
    {
      title: "Your assistant dashboard 👋",
      description:
        "This is your home screen. It collects everything that needs a person to look at it — requests to review, cars to hand back to customers, and the garage's progress. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="assistant-dashboard-repair-proposals-panel"]',
      title: "Repair proposals",
      description:
        "When the garage prepares a quote for a repair, it lands here. " +
        "These are quotes waiting on the customer to say yes or no. Click 'Open job' to see the details and follow up.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-pending-requests-panel"]',
      title: "Pending requests",
      description:
        "A 'request' is when an employee asks permission for something. " +
        "These ones have been sent up for review. Click 'Review' on any row to read it and decide what to do.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-workshop-panel"]',
      title: "Workshop status",
      description:
        "Every car currently in the garage, with what's being done and whether it's running over its estimated time. " +
        "Click 'View' to open any job.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-pickups-panel"]',
      title: "Upcoming pickups",
      description:
        "Cars that are finished and just waiting for the customer to collect them — oldest first. " +
        "When a customer takes their car, click 'Mark as Delivered' so it drops off this list.",
      side: "top",
      align: "start",
    },
    {
      title: "That's your dashboard! ✅",
      description:
        "Scroll down for warranty alerts too — cars whose warranty is about to run out. " +
        "The page refreshes itself every minute. Replay this tour anytime from your profile menu.",
    },
  ],
};
