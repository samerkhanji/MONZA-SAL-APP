import type { Tour } from "./types";

/**
 * Page tour: /garage/warranty.
 *
 * Plain-English walkthrough of the warranty cases list. A "warranty case" is
 * a repair the manufacturer pays for instead of the customer — for example
 * when something breaks that should not have.
 */
export const garageWarrantyPageTour: Tour = {
  id: "page-garage-warranty-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Warranty Cases page.",
  page: "/garage/warranty",
  steps: [
    {
      element: '[data-tour-id="warranty-new-case"]',
      title: "New case",
      description:
        "Click here when a customer has a problem the manufacturer should pay to fix. You pick the car, say what's wrong, and how serious it is. This opens a new warranty case.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="warranty-status-tabs"]',
      title: "Status tabs",
      description:
        "Each tab shows cases at one stage — just opened, being looked into, waiting for parts, in repair, or finished. Click a tab to see only those. The number shows how many.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-search"]',
      title: "Search box",
      description:
        "Type a case number, a VIN, a customer name, or a few words from the problem to find one case fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-table"]',
      title: "The cases list",
      description:
        "Every warranty case, newest first. It shows the car, the customer, the type, how serious it is, and the stage it's at. Click any row to open the full case and add parts, photos, and notes.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-new-dialog"]',
      title: "The new-case form",
      description:
        "This window asks for the car (by VIN), the customer, the kind of warranty, how serious it is, and a short summary of the problem. Fill it in and press 'Open case'.",
      side: "over",
      align: "center",
    },
  ],
};
