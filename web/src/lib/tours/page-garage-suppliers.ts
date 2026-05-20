import type { Tour } from "./types";

/**
 * Page tour: /garage/suppliers.
 *
 * Plain-English walkthrough of the suppliers list. A "supplier" is a shop or
 * company you buy parts and other things from.
 */
export const garageSuppliersPageTour: Tour = {
  id: "page-garage-suppliers-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Suppliers page.",
  page: "/garage/suppliers",
  steps: [
    {
      element: '[data-tour-id="suppliers-new"]',
      title: "New supplier",
      description:
        "Click here to add a company you buy from. You give its name, contact person, phone, and email. You need a supplier on file before you can make a purchase order.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="suppliers-search"]',
      title: "Search box",
      description:
        "Type a name, contact, phone, or email to find one supplier fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="suppliers-table"]',
      title: "The suppliers list",
      description:
        "Every company you buy from. It shows their contact details, how many orders you've placed with them, and how much you've paid them in total.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="suppliers-view-pos"]',
      title: "View purchase orders",
      description:
        "Click this on any supplier's row to see only the orders you've placed with that company.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="suppliers-edit"]',
      title: "Edit supplier",
      description:
        "Opens the supplier's details so you can fix a phone number, change the contact person, or add notes.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="suppliers-dialog"]',
      title: "The supplier form",
      description:
        "This window holds all the supplier's details — name, kind, contact, phone, email, address, and notes. Fill in what you know and press Save.",
      side: "over",
      align: "center",
    },
  ],
};
