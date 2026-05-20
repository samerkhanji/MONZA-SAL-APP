import type { Tour } from "./types";

/**
 * Page tour: /customers/[id] (Customer detail / profile).
 *
 * Short walkthrough of a single customer's page. Tone matches the owner
 * welcome tour: short, plain English, no jargon.
 */
export const customersDetailPageTour: Tour = {
  id: "page-customers-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the customer profile page.",
  page: "/customers/[id]",
  steps: [
    {
      element: '[data-tour-id="customers-detail-edit-button"]',
      title: "Edit the customer",
      description:
        "Click here to update this person's details — phone, email, name, or lead status.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="customers-detail-delete-button"]',
      title: "Delete the customer",
      description:
        "Removes this customer for good. The system asks you to confirm first, so it can't happen by accident.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="customers-detail-tabs"]',
      title: "The tabs",
      description:
        "Switch between this customer's profile, the cars linked to them, their interaction history, and their documents.",
      side: "bottom",
      align: "start",
    },
  ],
};
