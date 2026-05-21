import type { Tour } from "./types";

/**
 * Page tour: /company-costs.
 *
 * Trains a non-technical employee on the Company Costs ledger — what it is
 * for, how to record a cost, how to attach a cost to a car / supplier /
 * job, and what owners use it for. This system tracks COSTS only — it does
 * not record income, revenue, profit, or sale prices. Steps that would
 * point inside the (closed) add dialog are written as centered modal steps.
 *
 * Tone: plain English, like a colleague standing beside the user.
 */
export const companyCostsPageTour: Tour = {
  id: "page-company-costs-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Learn how to record and track company costs.",
  page: "/company-costs",
  estimatedMinutes: 4,
  steps: [
    {
      title: "Company Costs 👋",
      description:
        "This page tracks the money the company spends. Every cost should be recorded here so the owners can see the real cost of each car, each repair, each marketing campaign, and the whole business. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="company-costs-summary-cards"]',
      title: "Your spending at a glance",
      description:
        "These cards show how much the company spent this month and this year, and how many entries are still waiting for owner approval. They update automatically as new costs are added.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="company-costs-add-expense"]',
      title: "Add a cost",
      description:
        "This button records a new cost. Use it whenever the company pays for something — ads, parts, shipping, customs, electricity, salaries, rent, supplies, or repairs.",
      side: "bottom",
      align: "start",
    },
    {
      title: "Pick the right category",
      description:
        "Every cost needs a category — Marketing, Car, Parts, Garage, or Operating. The category is how owners later see where the money went, so choose it carefully. Add a short description too.",
    },
    {
      title: "Connect the cost to a car",
      description:
        "The form has a 'Related car' field. Use it when the cost belongs to a specific vehicle — shipping, customs, registration, repair before sale, detailing, or accessories. This is how owners see the true cost of each car.",
    },
    {
      title: "Connect to a supplier, job, or campaign",
      description:
        "You can also link a cost to a supplier (for parts you bought), a garage job (for repair costs), a purchase order, or a marketing campaign. The more you link, the better the reports become.",
    },
    {
      title: "Attach the receipt",
      description:
        "The form has an upload button for the receipt or invoice. Always attach it — it is the company's proof that the payment really happened.",
    },
    {
      element: '[data-tour-id="company-costs-filters"]',
      title: "Find any cost fast",
      description:
        "Use these filters to narrow the list by date range, category, or payment method. Handy when the owner asks 'how much did we spend on X?'.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="company-costs-reports"]',
      title: "Costs by car, category and campaign",
      description:
        "Owners use this section to check monthly costs, cost by category, marketing cost by campaign, cost by supplier, and the total cost recorded against each car.",
      side: "top",
      align: "start",
    },
    {
      title: "Avoid these mistakes ⚠️",
      description:
        "Don't skip recording small costs — they add up. Don't guess amounts; enter the real figure from the receipt. Don't pick the wrong car or category, or the reports will be wrong. If you're unsure, ask before saving. You can replay this tour anytime from your profile menu.",
    },
  ],
};
