import type { Tour } from "./types";

/**
 * Page tour: /accessories.
 *
 * Walks through the accessory catalog — searching and adding lines.
 * Tone matches the owner welcome tour: short, plain English.
 */
export const accessoriesPageTour: Tour = {
  id: "page-accessories-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Accessories page.",
  page: "/accessories",
  steps: [
    {
      element: '[data-tour-id="accessories-search-input"]',
      title: "Search accessories",
      description:
        "Type to find an accessory across every category at once — mats, dash cams, tint, and more.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="accessories-add-line-button"]',
      title: "Add a line",
      description:
        "Each category has its own 'Add line' button. Click it to add a new accessory to that group.",
      side: "left",
      align: "start",
    },
  ],
};
