import type { Tour } from "./types";

/**
 * Page tour: /customers.
 *
 * STATUS: stub — placeholder copy. Phase-2 content agent: rewrite the
 * `title` + `description` of each step in plain English, like the owner
 * welcome tour does.
 *
 * The CSS selectors reference `data-tour-id` attributes that another agent
 * will add to the `/customers` page in parallel — keep the IDs stable.
 */
export const customersPageTour: Tour = {
  id: "page-customers-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Customers page.",
  page: "/customers",
  steps: [
    {
      element: '[data-tour-id="customers-add-button"]',
      title: "Add Customer",
      description:
        "PLACEHOLDER: New lead just walked in? Add them here.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-search"]',
      title: "Search",
      description:
        "PLACEHOLDER: Find a customer by name, phone, or email.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-table"]',
      title: "Customer list",
      description:
        "PLACEHOLDER: Everyone who's ever talked to you about a car. Click a row to see their history.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-segment-tabs"]',
      title: "Segments",
      description:
        "PLACEHOLDER: Switch between Leads / Buyers / Inactive.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-import"]',
      title: "Import",
      description:
        "PLACEHOLDER: Bulk-load customers from a CSV.",
      side: "bottom",
      align: "end",
    },
  ],
};
