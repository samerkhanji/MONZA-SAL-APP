import type { Tour } from "./types";

/**
 * Page tour: /cars/[id] (Car detail / profile).
 *
 * Short walkthrough of a single car's page. Tone matches the owner welcome
 * tour: short, plain English, no jargon.
 */
export const carsDetailPageTour: Tour = {
  id: "page-cars-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the car profile page.",
  page: "/cars/[id]",
  steps: [
    {
      element: '[data-tour-id="cars-detail-edit-button"]',
      title: "Edit the car",
      description:
        "Click here to change any of this car's details — color, mileage, and more.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="cars-detail-move-button"]',
      title: "Move location",
      description:
        "Use this when the car physically moves to a different lot or showroom, so the system always knows where it is.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="cars-detail-scrap-button"]',
      title: "Scrap the car",
      description:
        "Only for cars written off for good. This is permanent, so the system asks you to confirm first.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="cars-detail-tabs"]',
      title: "The tabs",
      description:
        "Switch between this car's overview, its documents, and its movement history. Everything about the car lives under these tabs.",
      side: "bottom",
      align: "start",
    },
  ],
};
