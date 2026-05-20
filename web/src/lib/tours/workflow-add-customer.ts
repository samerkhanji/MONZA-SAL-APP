import type { Tour } from "./types";

/**
 * Workflow tour: "Log a new lead / customer".
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const addCustomerWorkflowTour: Tour = {
  id: "workflow-add-customer-v1",
  kind: "workflow",
  label: "Log a new lead",
  description: "Save a new customer or lead so you never lose track of them.",
  estimatedMinutes: 4,
  allowedRoles: [
    "owner",
    "sales_ops",
    "sales",
    "hybrid",
    "khalil_hybrid",
    "assistant",
  ],
  steps: [
    {
      title: "Let's log a lead",
      description:
        "Someone called or walked in asking about a car? Save them as a lead so you can " +
        "follow up later. I'll walk you through it. Hit 'Next' to start.",
    },
    {
      navigateTo: "/customers",
      element: '[data-tour-id="nav-customers"]',
      title: "Open Customers",
      description:
        "This is your list of everyone who's interested in buying — and everyone who has bought. " +
        "We start here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-list-add-button"]',
      title: "Click 'Add Customer'",
      description: "This button opens a blank customer form. Click it now.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      navigateTo: "/customers/add",
      element: '[data-tour-id="customers-add-personal-panel"]',
      title: "Who are they?",
      description:
        "This is where you write down the customer's details. The more you fill in, " +
        "the easier it is to follow up later.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-first-name-input"]',
      title: "Their name",
      description: "Type the customer's first name here.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="customers-add-phone-input"]',
      title: "Their phone number",
      description:
        "Type their phone number. This is the most important field — it's how you'll reach them.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="customers-add-email-input"]',
      title: "Their email (optional)",
      description:
        "Add their email if they gave you one. You can leave this blank if not.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-lead-status-select"]',
      title: "How warm are they?",
      description:
        "Pick a lead status — are they just browsing, seriously interested, or ready to buy? " +
        "This helps you spot who to chase first.",
      side: "right",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="customers-add-lead-source-select"]',
      title: "Where did they come from?",
      description:
        "Pick how they found you — a walk-in, a phone call, social media, a referral. " +
        "This tells you later which channels actually bring customers.",
      side: "right",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="customers-add-notes-panel"]',
      title: "Add notes",
      description:
        "Jot down anything useful — which car they liked, their budget, when to call back. " +
        "Future-you will thank present-you.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="customers-add-submit-button"]',
      title: "Save the customer",
      description: "All done? Click 'Add Customer' to save them to your list.",
      side: "top",
      align: "end",
      waitFor: "navigation",
    },
    {
      title: "Lead saved!",
      description:
        "Your new lead is in the system. You'll find them in the Customers list, " +
        "and you can open them anytime to log calls, book a test drive, or start a sale.",
    },
  ],
};
