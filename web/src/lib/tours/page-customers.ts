import type { Tour } from "./types";

/**
 * Page tour: /customers.
 *
 * Walks through every button on the customer list — adding people, switching
 * between All / Sold / Leads, searching, filtering, and the per-row menu.
 * Tone matches the owner welcome tour: short, plain English, no jargon.
 */
export const customersPageTour: Tour = {
  id: "page-customers-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Customers page.",
  page: "/customers",
  steps: [
    {
      element: '[data-tour-id="customers-list-add-button"]',
      title: "Add a customer",
      description:
        "New lead just walked in or called? Click here to add them, so you can keep track of every conversation.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="customers-list-tabs"]',
      title: "Customer tabs",
      description:
        "Four views of the same people: everyone, the ones who bought a car, the ones holding cars at a sub-dealer, and the leads to follow up. Same customers — just sliced different ways.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-breakdown"]',
      title: "Why the numbers differ",
      description:
        "Important logic: a customer can own or hold more than one car, so the people count and the car count are not the same. This line spells it out — e.g. '136 customers linked to 156 cars: 128 sold, 22 at sub-dealers, 6 other holdings'. 'Sold' = a real sale; 'sub-dealer' = a car parked at a partner/display, not a sale.",
      type: "section",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-all"]',
      title: "All customers",
      description:
        "Everyone in the system — buyers, sub-dealer holders, and leads together. This is the full head-count of people.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-sold"]',
      title: "Sold cars",
      description:
        "Your real buyers — customers whose car is actually sold. The badge counts bought customers; the list shows each sold car and who bought it (a buyer with two cars counts once on the badge but shows two rows). This is your buyer list.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-subdealer"]',
      title: "Sub Dealer",
      description:
        "Cars parked at a sub-dealer or display partner (e.g. AUTOMENA DISPLAY) — held, not sold. Each row is a held car and who holds it, with the date it went there. These never count as sales — that's the difference between this tab and Sold Cars.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-leads"]',
      title: "Leads",
      description:
        "Prospects who showed interest but haven't bought yet (status 'new lead'). These are the ones to follow up with. Empty for now — it fills as you add walk-ins and inquiries.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-filters-panel"]',
      title: "Filters",
      description:
        "This box has all the tools to narrow down the list — handy once you have lots of customers.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-search-input"]',
      title: "Search box",
      description:
        "Type a name, phone number, or email to find one person fast. The list shrinks as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-filter-status"]',
      title: "Filter by status",
      description:
        "Show only customers at a certain stage — new, interested, converted, and so on.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-filter-source"]',
      title: "Filter by source",
      description:
        "See where customers came from — walk-in, phone, website, referral. Useful for spotting which channels work best.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-table-panel"]',
      title: "The customer list",
      description:
        "Everyone who has talked to you, one per row. Click a row to open that person's full history — what they looked at, bought, and owe.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-row-actions-trigger"]',
      title: "Row actions menu",
      description:
        "The three-dots button on each row. Click it for quick actions on that customer.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-row-actions-view"]',
      title: "View customer",
      description:
        "Opens the customer's full page — contact details, vehicles, notes, and every interaction.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-row-actions-edit"]',
      title: "Edit the customer",
      description:
        "Update a phone number, fix a name, or change their lead status without leaving the list.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-row-actions-delete"]',
      title: "Delete the customer",
      description:
        "Removes the customer for good. The system asks you to confirm first, so you don't delete someone by accident.",
      side: "left",
      align: "start",
    },
  ],
};
