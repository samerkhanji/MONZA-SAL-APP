import type { Tour } from "./types";

/**
 * Page tour: /documents.
 *
 * Walks through finding a car's documents by VIN. Tone matches the owner
 * welcome tour: short, plain English, no jargon.
 */
export const documentsPageTour: Tour = {
  id: "page-documents-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Documents page.",
  page: "/documents",
  steps: [
    {
      element: '[data-tour-id="documents-search-panel"]',
      title: "Find documents",
      description:
        "This page pulls up a car's papers — registration, insurance, warranty. You look them up by the car's VIN.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="documents-vin-search-input"]',
      title: "VIN box",
      description:
        "Type the car's 17-character VIN here. It's the long code on the windshield or door frame.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="documents-scan-vin-button"]',
      title: "Scan instead",
      description:
        "Don't want to type the VIN? Click here to scan it with your camera — faster and no mistakes.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="documents-search-button"]',
      title: "Search",
      description:
        "Click this to look up the car. If you're not an owner, your request goes to management for approval first.",
      side: "bottom",
      align: "end",
    },
  ],
};
