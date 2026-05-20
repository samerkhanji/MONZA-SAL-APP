import type { Tour } from "./types";

/**
 * Page tour: /garage/efficiency.
 *
 * Plain-English walkthrough of the garage efficiency dashboard. A "job" is a
 * car being worked on. A "bay" is a parking spot in the workshop. This page
 * shows how well the workshop ran over the last 30 days.
 *
 * Note: the `data-tour-id` selectors here were already on the page from an
 * earlier pass — this file just supplies the tour content for them.
 */
export const garageEfficiencyPageTour: Tour = {
  id: "page-garage-efficiency-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every panel on the Garage Efficiency page.",
  page: "/garage/efficiency",
  steps: [
    {
      element: '[data-tour-id="garage-efficiency-jobs-panel"]',
      title: "Job efficiency",
      description:
        "This table compares the hours you guessed a job would take against the hours it really took. A green number means it was quicker than planned; a red number means it ran over. Use it to spot jobs that took too long.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-efficiency-bays-panel"]',
      title: "Bay utilization",
      description:
        "A bay is a parking spot in the workshop. This table shows how busy each bay has been over the last 30 days — how many cars used it and how full it was. Use it to see if a bay is sitting empty.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-efficiency-technicians-panel"]',
      title: "Technician efficiency",
      description:
        "One row per mechanic, showing how many jobs and hours they handled in the last 30 days. The last column compares their real time against the estimate — green is faster than planned, red is slower.",
      side: "top",
      align: "start",
    },
  ],
};
