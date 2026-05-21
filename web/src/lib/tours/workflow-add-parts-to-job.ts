import type { Tour } from "./types";

/**
 * Workflow tour: "Add parts used on a job".
 *
 * Recording which parts a mechanic used so they are billed and stock is right.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const addPartsToJobWorkflowTour: Tour = {
  id: "workflow-add-parts-to-job-v1",
  kind: "workflow",
  label: "Add parts to a job",
  description: "Record the parts a mechanic used on a garage job.",
  estimatedMinutes: 4,
  allowedRoles: [
    "owner",
    "garage_manager",
    "garage_staff",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's add parts to a job",
      description:
        "When a mechanic uses a part on a car, you record it on the job. " +
        "This bills the part to the customer and takes it out of your stock. " +
        "I'll walk you through it. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage",
      element: '[data-tour-id="nav-garage"]',
      title: "Open the Garage",
      description:
        "This is the jobs board. Start here to find the job the parts were used on.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-jobs-list"]',
      title: "Open the job",
      description:
        "Click the job's card to open it. Parts are added from inside the job.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="job-detail-parts"]',
      title: "The parts section",
      description:
        "This card lists every part used on the job so far. " +
        "Right now it may be empty — we're about to add one.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-scan-part"]',
      title: "Scan a part's barcode",
      description:
        "Fastest way to add a part: scan its barcode with your camera. " +
        "The system finds the right part for you. (Or use 'Add part' next.)",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-add-part"]',
      title: "Click 'Add part'",
      description:
        "Click 'Add part' to add a part by hand. This opens the parts picker.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="add-part-dialog"]',
      title: "Pick the part",
      description:
        "Search for the part by name or number, choose it, and set how many were used. " +
        "Only add parts that were really fitted to this car.",
      side: "over",
      align: "center",
    },
    {
      title: "Save the part",
      description:
        "Save the part to the job. Two things happen at once: " +
        "the part is billed to this job, and one is removed from your inventory stock.",
    },
    {
      title: "Watch the quantity",
      description:
        "Avoid this mistake: if you enter the wrong quantity, the customer is over- or under-charged " +
        "and your stock count goes wrong. Double-check the number before saving.",
    },
    {
      title: "Parts added!",
      description:
        "Done. The parts now show on the job and your stock is up to date. " +
        "Repeat this for every part the mechanic uses on the car.",
    },
  ],
};
