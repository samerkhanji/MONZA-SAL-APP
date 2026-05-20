import type { Tour } from "./types";

/**
 * Page tour: /garage (Jobs board).
 *
 * Plain-English walkthrough of the garage jobs board. A "job" is one car
 * being worked on in the workshop. A "bay" is a parking spot in the
 * workshop where a car sits while a mechanic fixes it.
 */
export const garagePageTour: Tour = {
  id: "page-garage-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Garage Jobs board.",
  page: "/garage",
  steps: [
    {
      element: '[data-tour-id="garage-new-job"]',
      title: "New Job",
      description:
        "Click here when a car comes in for repair or service. It opens a form where you pick the car, say what's wrong, and who will work on it. This starts a brand-new job.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="garage-scan-vin"]',
      title: "Scan VIN",
      description:
        "In a hurry? Point your camera at the car's VIN barcode (the long code on the windshield). The system finds the car for you, so you don't have to type it. Then it opens a new job for that car.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="garage-time-reports-link"]',
      title: "Time reports",
      description:
        "Jumps to a page that shows how many hours each mechanic worked. Use it when you want to check who did what and how long it took.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="garage-export"]',
      title: "Export",
      description:
        "Downloads the list of jobs as a spreadsheet file. Handy when you want to print it, email it, or keep a copy.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="garage-bays-section"]',
      title: "The bays",
      description:
        "Each box here is a bay — a parking spot in your workshop. It shows which car is in which spot right now. Drag a job onto an empty bay to move that car in.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-stats"]',
      title: "Quick numbers",
      description:
        "Four counters at a glance: jobs marked urgent, jobs being worked on now, jobs waiting for parts to arrive, and jobs finished today. A fast health check for the workshop.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-status-filter"]',
      title: "Filter by status",
      description:
        "Click a pill to show only jobs at that stage — for example only the ones being worked on, or only the ones waiting for parts. Click 'All' to see everything again.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-priority-filter"]',
      title: "Filter by priority",
      description:
        "Show only urgent, normal, or low-priority jobs. Use 'Urgent' when you want to see what needs doing first.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-search"]',
      title: "Search box",
      description:
        "Type a VIN, a reason for the visit, or a mechanic's name to find one job fast instead of scrolling.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="garage-jobs-list"]',
      title: "The jobs list",
      description:
        "Every car in the workshop, one card each. Each card has buttons to Start the work, Finish it, change its status, or Open Job to see full details. Urgent jobs and ones due today are highlighted so they stand out.",
      side: "top",
      align: "start",
    },
  ],
};
