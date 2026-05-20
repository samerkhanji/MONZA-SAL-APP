import type { Tour } from "./types";

/**
 * Page tour: /garage/warranty/[id] (one warranty case).
 *
 * Plain-English walkthrough of a single warranty case — a repair the
 * manufacturer pays for.
 */
export const garageWarrantyDetailPageTour: Tour = {
  id: "page-garage-warranty-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through a single warranty case's page.",
  page: "/garage/warranty/[id]",
  steps: [
    {
      element: '[data-tour-id="warranty-detail-status"]',
      title: "Change the status",
      description:
        "Use this dropdown to move the case along — for example from 'investigating' to 'in repair' to 'completed'. It tells everyone where the case stands.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="warranty-detail-summary"]',
      title: "Case details",
      description:
        "The basics of the case: the car (by VIN), the customer, the kind of warranty, and when it was opened. Links here jump to the car or customer's full page.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-detail-parts"]',
      title: "Parts used or claimed",
      description:
        "List the spare parts this repair needed. Add each one with its quantity and cost — this is what you claim back from the manufacturer.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-detail-documents"]',
      title: "Photos and documents",
      description:
        "Attach photos of the fault and any paperwork. Proof helps when the manufacturer reviews the claim. Use the Upload box to add files.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-detail-resolution"]',
      title: "Resolution",
      description:
        "Write down what was done and what was claimed back. From here you can also start a refund tied to this case if the customer is owed money.",
      side: "top",
      align: "start",
    },
  ],
};
