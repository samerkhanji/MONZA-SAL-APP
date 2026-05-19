import type { Tour } from "./types";

/**
 * Page tour: /cars (Inventory).
 *
 * STATUS: stub — placeholder copy. Phase-2 content agent: rewrite each step's
 * `title` + `description` in plain English, like the owner welcome tour.
 *
 * The CSS selectors below reference `data-tour-id` attributes that another
 * agent will add to the `/cars` page in parallel. The IDs we name here are
 * the contract — keep them stable.
 */
export const carsPageTour: Tour = {
  id: "page-cars-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Inventory page.",
  page: "/cars",
  steps: [
    {
      element: '[data-tour-id="cars-add-button"]',
      title: "Add Car button",
      description:
        "PLACEHOLDER: Click here to add a new car to your fleet.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-search"]',
      title: "Search & filter",
      description:
        "PLACEHOLDER: Find a car by VIN, plate, or model. Use the filters below for status / year.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-table"]',
      title: "The inventory table",
      description:
        "PLACEHOLDER: Every car you own. Click a row for the full story of that vehicle.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-status-tabs"]',
      title: "Status tabs",
      description:
        "PLACEHOLDER: Switch between Available / Sold / In Garage views.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-export"]',
      title: "Export",
      description:
        "PLACEHOLDER: Pull the current view down as a CSV.",
      side: "bottom",
      align: "end",
    },
  ],
};
