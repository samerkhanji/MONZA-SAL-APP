import type { Tour } from "./types";

/**
 * Page tour: /company-costs.
 *
 * Trains a non-technical employee on the Company Costs ledger — what it is
 * for, how to record an expense or income, how to attach a cost to a car /
 * supplier / job, and what owners use it for. Steps that would point inside
 * the (closed) add dialog are written as centered modal steps instead.
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
        "This page tracks money going in and out of the company. Every expense should be recorded here so the owners can understand the real cost of each car, each repair, each marketing campaign, and the whole business. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="company-costs-summary-cards"]',
      title: "Your money at a glance",
      description:
        "These cards show what the company spent and earned this month and this year. They update automatically as new entries are added.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="company-costs-add-expense"]',
      title: "Add an expense",
      description:
        "This button adds a new expense. Use it whenever the company pays for something — ads, parts, shipping, customs, electricity, salaries, rent, supplies, or repairs.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="company-costs-add-income"]',
      title: "Add income",
      description:
        "This button records money coming in. Most income comes from car sales, but use this for any other money the company receives.",
      side: "bottom",
      align: "start",
    },
    {
      title: "Pick the right category",
      description:
        "Every entry needs a category — Marketing, Car, Parts, Garage, or Operating. The category is how owners later see where the money went, so choose it carefully. Add a short description too.",
    },
    {
      title: "Connect the cost to a car",
      description:
        "The form has a 'Related car' field. Use it when the cost belongs to a specific vehicle — shipping, customs, registration, repair before sale, detailing, or accessories. This is how owners see the true cost of each car.",
    },
    {
      title: "Connect to a supplier, job, or campaign",
      description:
        "You can also link an entry to a supplier (for parts you bought), a garage job (for repair costs), a purchase order, or a marketing campaign. The more you link, the better the reports become.",
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
        "Use these filters to narrow the list by date range, category, payment method, or type (income vs expense). Handy when the owner asks 'how much did we spend on X?'.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="company-costs-reports"]',
      title: "Costs and profit by car",
      description:
        "Owners use this section to check monthly costs, cost by category, marketing cost by campaign, and the profit or loss on each car once all its costs are recorded.",
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
