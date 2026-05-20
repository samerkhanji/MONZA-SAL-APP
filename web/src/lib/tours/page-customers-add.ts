import type { Tour } from "./types";

/**
 * Page tour: /customers/add (Add Customer form).
 *
 * Short walkthrough of the new-customer form. Tone matches the owner welcome
 * tour: short, plain English, no jargon.
 */
export const customersAddPageTour: Tour = {
  id: "page-customers-add-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Add Customer form.",
  page: "/customers/add",
  steps: [
    {
      element: '[data-tour-id="customers-add-personal-panel"]',
      title: "Personal information",
      description:
        "Start here. This card holds the basics — the customer's name and how to reach them.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-phone-input"]',
      title: "Phone number",
      description:
        "The most important field — it's how you'll call or message the customer later.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-lead-panel"]',
      title: "Lead information",
      description:
        "Note how interested the customer is and where they came from — walk-in, phone, website, or a referral.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-notes-panel"]',
      title: "Notes",
      description:
        "Jot down anything useful — which car they liked, their budget, when to follow up.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-submit-button"]',
      title: "Add the customer",
      description:
        "When the form looks right, click here to save the customer into the system.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-cancel-button"]',
      title: "Cancel",
      description:
        "Changed your mind? Click here to leave without saving. Nothing you typed is kept.",
      side: "top",
      align: "start",
    },
  ],
};
