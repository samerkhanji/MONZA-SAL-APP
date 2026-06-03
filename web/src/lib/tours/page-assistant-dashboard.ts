import type { Tour } from "./types";

/**
 * Page tour: /assistant-dashboard.
 *
 * The assistant dashboard is the home screen for the request assistant —
 * it surfaces what needs a human's attention: requests to review, overdue
 * payments, cars ready for pickup, and repair quotes waiting on the customer.
 *
 * Tone: short sentences, plain English, like a colleague standing beside the
 * user. Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const assistantDashboardPageTour: Tour = {
  id: "page-assistant-dashboard-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the assistant dashboard.",
  page: "/assistant-dashboard",
  estimatedMinutes: 2,
  steps: [
    {
      element: '[data-tour-id="assistant-dashboard-summary-cards"]',
      title: "Your assistant dashboard",
      description:
        "This is your home screen. It shows the most important things that need attention today, like requests, overdue payments, cars ready for pickup, and repair proposals.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-pending-requests-panel"]',
      title: "Requests needing review",
      description:
        "This card shows employee requests that need someone to check them. Open it to review the request and decide who should handle it.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-overdue-installments-card"]',
      title: "Overdue installments",
      description:
        "This card shows customers who are late on payments. Use it to follow up before the problem becomes bigger.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-pickups-panel"]',
      title: "Cars ready for pickup",
      description:
        "This card shows cars that are finished and ready to be handed back to the customer.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="assistant-dashboard-repair-proposals-panel"]',
      title: "Repair proposals",
      description:
        "This section shows repair quotes waiting for customer approval. Open the job, check the quote, then follow up with the customer.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="sidebar-nav"]',
      title: "Sidebar menu",
      description:
        "Use this menu to move between the main parts of the system. Each page has a specific job.",
      side: "right",
      align: "start",
    },
    {
      title: "Restart help anytime",
      description:
        "You can restart this tour anytime if you forget how the page works. Open the ? button in the bottom-right corner and choose this page.s guide.",
    },
  ],
};
