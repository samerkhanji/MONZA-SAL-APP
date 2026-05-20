import type { Tour } from "./types";

/**
 * Page tour: /garage/tasks (Task board).
 *
 * Plain-English walkthrough of the garage task board. A "task" is one small
 * step of work on a car (for example "change oil" or "rotate tyres"). Tasks
 * are grouped under the car they belong to.
 */
export const garageTasksPageTour: Tour = {
  id: "page-garage-tasks-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Garage Task board.",
  page: "/garage/tasks",
  steps: [
    {
      element: '[data-tour-id="tasks-create-checklist"]',
      title: "Create checklist from template",
      description:
        "Click here to add a ready-made list of jobs to a car all at once. Pick the car, pick a template (like 'Full service'), and the system creates every task for you. Saves typing the same steps over and over.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="tasks-checklist-dialog"]',
      title: "The checklist form",
      description:
        "This little window asks two things: which car the work is for, and which template to use. Choose both, then press 'Create tasks'.",
      side: "over",
      align: "center",
    },
    {
      element: '[data-tour-id="tasks-board"]',
      title: "The task board",
      description:
        "Every car being worked on, with its open tasks listed underneath. One card per car. This is the main work list for the whole workshop.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-row"]',
      title: "A single task",
      description:
        "Each row is one job to do on the car. It shows what the job is and a coloured tag for how it's going — not started, in progress, blocked, or done.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-status"]',
      title: "Change the status",
      description:
        "Use this dropdown to say where the task stands. Set it to 'In progress' when you start, and 'Done' when you finish.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-assigned"]',
      title: "Assign the task",
      description:
        "Pick which mechanic should do this task. Leave it 'Unassigned' if nobody has it yet.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-resource"]',
      title: "Set the resource",
      description:
        "Says which tool or area the job needs — for example the lift or the alignment machine. This helps avoid two tasks fighting over the same equipment.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="tasks-task-timer"]',
      title: "Start and Stop the timer",
      description:
        "Press 'Start' when you begin working on this task and 'Stop' when you pause or finish. The system counts your hours so the job's real time is recorded.",
      side: "top",
      align: "end",
    },
  ],
};
