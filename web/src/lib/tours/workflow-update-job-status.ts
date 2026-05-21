import type { Tour } from "./types";

/**
 * Workflow tour: "Update a garage job's status".
 *
 * Moving a job through its stages — waiting, in progress, done.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const updateJobStatusWorkflowTour: Tour = {
  id: "workflow-update-job-status-v1",
  kind: "workflow",
  label: "Update a job's status",
  description: "Move a garage job through its stages — waiting, in progress, done.",
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
      title: "Let's move a job along",
      description:
        "Every job in the workshop goes through stages: waiting, in progress, and done. " +
        "As the work happens, you update the job so everyone can see where it stands. " +
        "I'll show you how. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage",
      element: '[data-tour-id="nav-garage"]',
      title: "Open the Garage",
      description:
        "This is the jobs board. Every car being worked on shows up here as a card.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-status-filter"]',
      title: "The status filter",
      description:
        "These buttons sort the board by stage. Click a stage to see only the jobs at that point. " +
        "It's a fast way to find the job you need.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-search"]',
      title: "Find the job",
      description:
        "Type the car's plate, VIN, or the customer name to jump straight to the job you want to update.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="garage-jobs-list"]',
      title: "Open the job",
      description:
        "Click the job's card on the board to open it. You change the status from inside the job.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="job-detail-toolbar"]',
      title: "The job toolbar",
      description:
        "This bar at the top of a job holds the main controls — the work timer and the finish button. " +
        "Use it to push the job forward.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="job-detail-timer"]',
      title: "Start the work",
      description:
        "When the mechanic actually begins, press start on this timer. " +
        "That moves the job into 'in progress' and starts counting the work time.",
      side: "bottom",
      align: "start",
    },
    {
      title: "While the job is running",
      description:
        "The timer counts the hours spent. If the mechanic stops for a break or for parts, " +
        "pause the timer. Don't leave it running overnight — that makes the hours wrong.",
    },
    {
      element: '[data-tour-id="job-detail-complete"]',
      title: "Finish the job",
      description:
        "When all the work is done, click 'Complete'. A short form opens to confirm the final details. " +
        "This moves the job to 'done'.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Confirm the finish",
      description:
        "In the finish form, check the hours and notes, then confirm. " +
        "Avoid this mistake: don't mark a job done before the parts and work are really finished — " +
        "the customer may be charged from here.",
    },
    {
      title: "Job status updated!",
      description:
        "Done. The job has moved to its new stage and everyone on the board can see it. " +
        "Keep statuses current — that's how the team knows what's left to do.",
    },
  ],
};
