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
        "Three views of the same people. Use these tabs to flip between all customers, the ones who bought, and the leads.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-all"]',
      title: "All customers",
      description:
        "Everyone in the system — leads and buyers together. This is the full list.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-sold"]',
      title: "Sold cars",
      description:
        "Customers who actually bought a car. Open this when you want your real buyer list.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-tab-leads"]',
      title: "Leads",
      description:
        "People who showed interest but haven't bought yet. These are the ones to follow up with.",
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
