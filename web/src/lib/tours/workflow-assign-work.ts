import type { Tour } from "./types";

/**
 * Workflow tour: "Assign work to a manager or employee".
 *
 * Putting a job or task in someone's hands so they know it's theirs.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const assignWorkWorkflowTour: Tour = {
  id: "workflow-assign-work-v1",
  kind: "workflow",
  label: "Assign work to someone",
  description: "Give a job or task to a garage manager or employee.",
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
      title: "Let's hand out some work",
      description:
        "A job or task means nothing until someone is responsible for it. " +
        "Assigning work tells a person 'this one is yours'. I'll show you how. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage",
      element: '[data-tour-id="nav-garage"]',
      title: "Open the Garage",
      description:
        "This is the jobs board. Start here to find a job you want to give to someone.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="garage-jobs-list"]',
      title: "Open the job",
      description:
        "Click the job's card to open it. You set who is responsible from inside the job.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Find the 'Assigned To' field",
      description:
        "Inside the job, look in the Job Info section for 'Assigned To'. " +
        "This shows who is in charge of this job right now. If it says '—', nobody has it yet.",
    },
    {
      title: "Pick the person",
      description:
        "Choose the manager or employee who should do the work. " +
        "Pick someone who is free and has the right skills — don't pile everything on one person.",
    },
    {
      element: '[data-tour-id="job-detail-timer"]',
      title: "They take it from here",
      description:
        "Once assigned, that person starts the work timer when they begin. " +
        "The job now clearly belongs to them.",
      side: "bottom",
      align: "start",
    },
    {
      navigateTo: "/garage/tasks",
      element: '[data-tour-id="nav-garage-tasks"]',
      title: "Tasks work the same way",
      description:
        "Smaller jobs are broken into tasks. Open the Tasks page to hand those out too.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-assigned"]',
      title: "Assign a task",
      description:
        "Each task row has an 'assigned' area. Pick the person here, the same way as a job. " +
        "Now they know that task is theirs.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-status"]',
      title: "They update their progress",
      description:
        "Once a task is theirs, the person changes its status here as they work — " +
        "so you can see progress without asking.",
      side: "left",
      align: "start",
    },
    {
      title: "Work assigned!",
      description:
        "Done. Every job and task now has a clear owner. " +
        "When work is assigned properly, nothing gets forgotten and nobody is unsure what to do next.",
    },
  ],
};
