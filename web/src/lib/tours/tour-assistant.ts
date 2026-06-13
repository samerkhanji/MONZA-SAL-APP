import type { Tour } from "./types";

/**
 * Assistant welcome tour — the assistant sees almost the whole operation
 * (everything except the owner-only dashboards and Settings), so this is a
 * broad, hand-held walk through the day, written to baby-feed every step.
 * Auto-fires on first login for the assistant role.
 */
export const assistantWelcomeTour: Tour = {
  id: "welcome-assistant-v1",
  kind: "welcome",
  label: "Assistant full tour",
  description: "Walks the assistant through the whole operation, step by step.",
  allowedRoles: ["assistant"],
  steps: [
    {
      title: "Welcome 👋 You keep everything moving",
      description:
        "Hi! You can see almost the whole business — sales, the garage, the paperwork. In a couple of minutes I'll walk you through each screen and tell you exactly what it's for. Press 'Next' to begin; replay any time from the ? button in the bottom-right.",
    },
    {
      title: "How it all connects 🔗",
      description:
        "The whole loop: a car arrives → it's in Inventory (incoming ones wait on Ordered Cars) → a buyer shows interest → they become a Customer → book a Test Drive → a Sales Order makes the sale → monthly money lives in Installments → any car needing service becomes a Garage job that pulls Parts. You help at every stage. Let's walk it.",
      type: "section",
    },
    {
      element: '[data-tour-id="nav-assistant-dashboard"]',
      navigateTo: "/assistant-dashboard",
      title: "1. Your dashboard",
      description:
        "Your home base. The key numbers and anything that needs attention today land here. Open it first thing each morning.",
    },
    {
      element: '[data-tour-id="nav-cars"]',
      navigateTo: "/cars",
      title: "2. Cars — the stock",
      description:
        "Every car on the floor. Search by model, color, or VIN. Each is tagged EREV or Pure EV. Incoming cars (ordered, not arrived) are on the separate Ordered Cars page. Click a row for the full story.",
    },
    {
      element: '[data-tour-id="nav-customers"]',
      navigateTo: "/customers",
      title: "3. Customers",
      description:
        "Everyone who's talked to you about buying, and everyone who has bought. The tabs split them into buyers, sub-dealer holders, and leads to chase. One person can hold several cars, so the people count and car count differ. Add new leads with 'Add Customer'.",
    },
    {
      element: '[data-tour-id="nav-test-drive"]',
      navigateTo: "/test-drive",
      title: "4. Test Drives",
      description:
        "Book a drive: pick the car, the customer, and the time. It reserves the car so two people don't clash, and reminds you to follow up after.",
    },
    {
      element: '[data-tour-id="nav-installments"]',
      navigateTo: "/installments",
      title: "5. Installments",
      description:
        "Every monthly payment for customers who pay over time. Late ones show in red. When money comes in, find the row and click 'Mark Paid'. Check it weekly so nobody slips.",
    },
    {
      element: '[data-tour-id="nav-garage"]',
      navigateTo: "/garage",
      title: "6. The Garage",
      description:
        "Service jobs in progress, mechanics' tasks, warranty claims, recalls, and the Parts store (viewable by part, by shelf, or as totals with a reorder list). Click a job to see its details.",
    },
    {
      element: '[data-tour-id="nav-documents"]',
      navigateTo: "/documents",
      title: "7. Documents",
      description:
        "Every car's papers — registration, insurance, warranty. Search by VIN to pull one up. You can request access to anything you can't yet see.",
    },
    {
      element: '[data-tour-id="nav-data-health"]',
      navigateTo: "/data-health",
      title: "8. Data Health",
      description:
        "Anything missing or broken — cars with no VIN, customers with no phone — is listed here. Cleaning it up keeps the reports honest. A great daily habit.",
    },
    {
      element: '[data-tour-id="nav-requests"]',
      navigateTo: "/requests",
      title: "9. Requests",
      description:
        "Approvals flow through here. You'll see what's waiting, what's approved, and what needs the owner. Urgent items show in red.",
    },
    {
      title: "That's the whole operation 🎉",
      description:
        "You've seen every area you touch. Each page has a ? button to replay its own mini-tour, and the chat assistant in the bottom-right answers any 'how do I…' question. Go explore — you can't break anything.",
    },
  ],
};
