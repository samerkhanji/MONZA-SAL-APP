import type { Tour } from "./types";

/**
 * Page tour: /garage/settings.
 *
 * Plain-English walkthrough of the garage workflow setup page. "Capacity"
 * means how many cars can use one tool or area at the same time. A "template"
 * is a ready-made checklist of jobs you can drop onto a car.
 */
export const garageSettingsPageTour: Tour = {
  id: "page-garage-settings-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Garage Settings page.",
  page: "/garage/settings",
  steps: [
    {
      element: '[data-tour-id="settings-capacities-panel"]',
      title: "Resource capacities",
      description:
        "This box sets how many cars can use each tool or area at once — for example how many cars the car wash can take. It also shows how many are using each one right now.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-capacity-row"]',
      title: "Set one capacity",
      description:
        "Type a number for how many cars this tool can handle, then press Save. The line above shows how many are in use compared to the limit.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-templates-panel"]',
      title: "Task templates",
      description:
        "Templates are ready-made checklists — like 'Full service' or 'Tyre change'. You drop a whole template onto a car so you don't type the same steps every time.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-new-template"]',
      title: "New template",
      description:
        "Click here to make a brand-new checklist. You give it a name first, then add the steps to it.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="settings-new-template-dialog"]',
      title: "The new-template form",
      description:
        "This small window just asks for the template's name. Type it and press 'Create' — then you'll add the checklist lines below.",
      side: "over",
      align: "center",
    },
    {
      element: '[data-tour-id="settings-template-card"]',
      title: "A template",
      description:
        "Each box is one checklist. It lists every step inside it. System templates are built-in; the ones you made yourself can be deleted with the bin button.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-template-add-line"]',
      title: "Add a line",
      description:
        "Type a new step for this checklist and press 'Add line'. Each line becomes one task when the template is used on a car.",
      side: "top",
      align: "start",
    },
  ],
};
