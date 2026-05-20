import type { Tour } from "./types";

/**
 * Page tour: /garage/jobs/[id] (one job).
 *
 * Plain-English walkthrough of a single garage job — one car being worked on
 * in the workshop.
 */
export const garageJobDetailPageTour: Tour = {
  id: "page-garage-job-detail-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through a single garage job's page.",
  page: "/garage/jobs/[id]",
  steps: [
    {
      element: '[data-tour-id="job-detail-back"]',
      title: "Back to the jobs board",
      description:
        "Takes you back to the main list of jobs when you're done with this car.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-timer"]',
      title: "Work timer",
      description:
        "Start this clock when you begin working on the car and stop it when you pause. It records the real hours spent, which feeds the time reports.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-complete"]',
      title: "Complete the job",
      description:
        "Press this when the car is fixed. It opens a short form to confirm the work is done and hands the car back as ready.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="job-detail-diagnosis"]',
      title: "Diagnosis and work",
      description:
        "Write what you found wrong with the car and what you did to fix it. Your notes save by themselves when you click away.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-add-part"]',
      title: "Add a part",
      description:
        "Click here to record a spare part used on this car. It takes the part out of stock automatically so the parts store stays correct.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-documents"]',
      title: "Documents",
      description:
        "Attach photos and paperwork for this job — before-and-after pictures, the work order, anything useful to keep with the car's record.",
      side: "top",
      align: "start",
    },
  ],
};
