import type { Tour } from "./types";

/**
 * Page tour: /data-health.
 *
 * "Data health" is the page that flags missing or broken information — a car
 * with no VIN, a customer with no phone number, a job with no notes. Cleaning
 * it up keeps your reports honest.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const dataHealthPageTour: Tour = {
  id: "page-data-health-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Data Health page.",
  page: "/data-health",
  steps: [
    {
      title: "Data Health 🩺",
      description:
        "This page is a health check for your information. It finds anything missing or broken — a car with no VIN, a customer with no phone number, a job with no notes. " +
        "Fixing these keeps your reports trustworthy. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="data-health-severity-totals"]',
      title: "Critical vs. warnings",
      description:
        "Two counts at the top. Red 'Critical' issues can really hurt you — like a sold car with no paperwork. " +
        "Orange 'Warnings' are softer — a missing colour or note. Always clear the red ones first.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-search-input"]',
      title: "Search",
      description:
        "Looking for problems on one specific car or customer? Type a VIN, name, or phone number here to filter the whole page down to just that record.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-filter-section"]',
      title: "Section filter",
      description:
        "The page is split into sections — cars, customers, sales orders, garage, and more. " +
        "Pick one here to focus on just that area instead of scrolling through everything.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-filter-severity"]',
      title: "Severity filter",
      description:
        "Show everything, or just the critical issues, or just the warnings. " +
        "Set this to 'Critical only' when you want to fix the most urgent problems and ignore the rest for now.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-summary-panel"]',
      title: "Your health score",
      description:
        "A simple score showing how complete your data is. " +
        "100% means nothing is missing. The closer to 100, the more you can trust the numbers in your reports.",
      side: "top",
      align: "start",
    },
    {
      title: "That's Data Health! ✅",
      description:
        "Below this you'll find each section listed out, with a row for every problem and an 'Edit' or 'Open' button to fix it. " +
        "Try to clear it out regularly. Replay this tour anytime from your profile menu.",
    },
  ],
};
