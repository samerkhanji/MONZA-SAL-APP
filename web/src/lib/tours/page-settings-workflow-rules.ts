import type { Tour } from "./types";

/**
 * Page tour: /settings/workflow-rules (short tour).
 *
 * Workflow rules are if-this-then-that automations: who automatically gets a
 * task when a car comes in, and who automatically hears about an event.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const settingsWorkflowRulesPageTour: Tour = {
  id: "page-settings-workflow-rules-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through workflow rules.",
  page: "/settings/workflow-rules",
  steps: [
    {
      title: "Workflow rules 🔁",
      description:
        "Workflow rules are simple 'if this, then that' automations. They decide who gets a job and who gets told when something happens — so you don't have to assign everything by hand. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="workflow-rules-tabs"]',
      title: "Two kinds of rule",
      description:
        "There are two tabs. 'Task routing' is about who gets the work. 'Notification events' is about who gets the message. Click between them to switch.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="workflow-rules-tab-routing"]',
      title: "Task routing",
      description:
        "This tab decides who is handed a task automatically — for example, 'when a car comes in for service, give the job to the garage manager'.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="workflow-rules-routing-panel"]',
      title: "Who gets the task",
      description:
        "Pick a category, then add rows for who should be assigned. 'Primary' is the main owner of the task; 'Parallel' rows are extra people who work on it too.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="workflow-rules-tab-events"]',
      title: "Notification events",
      description:
        "This tab decides who gets a notification when an event fires — for example, 'when a trade-in is approved, tell the sales rep'.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="workflow-rules-events-panel"]',
      title: "Who hears about it",
      description:
        "Pick an event, then add who should be notified and on which channel. Changes here apply right away to the next event that fires.",
      side: "top",
      align: "start",
    },
  ],
};
