import type { Tour } from "./types";

/**
 * Page tour: /garage/time-reports.
 *
 * Plain-English walkthrough of the employee time reports. This page adds up
 * the hours each mechanic worked on jobs.
 */
export const garageTimeReportsPageTour: Tour = {
  id: "page-garage-time-reports-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Garage Time Reports page.",
  page: "/garage/time-reports",
  steps: [
    {
      element: '[data-tour-id="time-reports-back"]',
      title: "Back to Garage Jobs",
      description:
        "Takes you back to the main jobs board when you're done looking at the hours.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="time-reports-table"]',
      title: "Hours by employee",
      description:
        "One row per mechanic. It shows how many jobs they touched today and how many hours they worked today, this week, and this month. The hours come only from finished work sessions, so timers still running are not counted yet.",
      side: "top",
      align: "start",
    },
  ],
};
