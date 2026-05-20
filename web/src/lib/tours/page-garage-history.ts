import type { Tour } from "./types";

/**
 * Page tour: /garage/history.
 *
 * Plain-English walkthrough of the garage history page — the record of every
 * job that is finished or cancelled. A "job" is one car that was worked on.
 */
export const garageHistoryPageTour: Tour = {
  id: "page-garage-history-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Garage History page.",
  page: "/garage/history",
  steps: [
    {
      element: '[data-tour-id="history-export"]',
      title: "Export",
      description:
        "Downloads the finished and cancelled jobs as a spreadsheet — handy for records or reports.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="history-stats"]',
      title: "Quick numbers",
      description:
        "Three counters: jobs completed, jobs cancelled, and jobs finished today. A fast look at past work.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="history-status-filter"]',
      title: "Filter by status",
      description:
        "Show all past jobs, or only the completed ones, or only the cancelled ones.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="history-search"]',
      title: "Search box",
      description:
        "Type a VIN, a job title, or a mechanic's name to find one old job fast.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="history-vin-scan"]',
      title: "Scan a VIN",
      description:
        "Point your camera at a car's VIN barcode to instantly search this car's past jobs — no typing.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="history-list"]',
      title: "The history list",
      description:
        "Every finished or cancelled job, newest first. Each card shows the car, the hours, the parts used, and when it was done. Click 'View Job' on any card for the full details.",
      side: "top",
      align: "start",
    },
  ],
};
