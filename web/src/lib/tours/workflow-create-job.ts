import type { Tour } from "./types";

/**
 * Workflow tour: "Create a garage job for a car".
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const createJobWorkflowTour: Tour = {
  id: "workflow-create-job-v1",
  kind: "workflow",
  label: "Create a garage job",
  description: "Open a new repair or service job for a car in the workshop.",
  estimatedMinutes: 5,
  allowedRoles: [
    "owner",
    "garage_manager",
    "garage_staff",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's create a garage job",
      description:
        "A car needs work in the workshop? You open a job for it. " +
        "I'll walk you through it. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage",
      element: '[data-tour-id="nav-garage"]',
      title: "Open the Garage",
      description:
        "This is the garage jobs board — every car being worked on lives here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-jobs-list"]',
      title: "The jobs board",
      description:
        "Each card on this board is one job. They move across as work progresses — " +
        "waiting, in progress, done. We're about to add a new one.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour="scan-vin-button"]',
      title: "Scan a car's VIN",
      description:
        "Fastest way to start a job: scan the car's VIN with your camera. " +
        "The system finds the car for you. (Or use 'New Job' next.)",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="new-job-button"]',
      title: "Click 'New Job'",
      description:
        "Click 'New Job' to open the job form. This is how you create a job by hand.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      title: "The job form",
      description:
        "Clicking 'New Job' opens a window where you describe the job. Pick the car it's for, " +
        "and write down what needs doing.",
    },
    {
      title: "Fill in the job details",
      description:
        "Choose the car, set the job type, describe the problem or service needed, " +
        "and set a priority. The more detail you add, the easier it is for the mechanic.",
    },
    {
      title: "Create the job",
      description:
        "When the form is filled in, click the submit button at the bottom of the dialog. " +
        "The new job appears on the board straight away.",
    },
    {
      element: '[data-tour-id="garage-jobs-list"]',
      title: "Open the new job",
      description:
        "Your new job is now on the board. Click its card to open it and assign " +
        "a mechanic, add parts, or start the timer.",
      side: "top",
      align: "start",
    },
    {
      title: "Track the work",
      description:
        "Inside a job you'll find a timer that tracks how long the work takes. " +
        "The mechanic starts it when they begin and stops it when they pause.",
    },
    {
      title: "Add parts as you go",
      description:
        "Need a part for the job? Click 'Add part' on the job page to pull it from inventory. " +
        "It gets billed to the job automatically.",
    },
    {
      title: "Job created!",
      description:
        "The job is live on the board. As the mechanic works, the job moves through its stages — " +
        "and when it's done, you'll click 'Complete'.",
    },
  ],
};
