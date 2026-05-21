import type { Tour } from "./types";

/**
 * Workflow tour: "Handle a recall".
 *
 * A manufacturer recall — logging it, finding the affected cars, and getting
 * them fixed.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const handleRecallWorkflowTour: Tour = {
  id: "workflow-handle-recall-v1",
  kind: "workflow",
  label: "Handle a recall",
  description: "Log a manufacturer recall and assign the affected cars for repair.",
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
      title: "Let's handle a recall",
      description:
        "Sometimes a manufacturer says a batch of cars has a fault that must be fixed. " +
        "That's a recall. You log it, find which of your cars are affected, and get them in. " +
        "Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage/recalls",
      element: '[data-tour-id="nav-recalls"]',
      title: "Open Recalls",
      description:
        "This is the Recalls page. Every recall you're tracking lives here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="recalls-status-tabs"]',
      title: "Recalls by stage",
      description:
        "These tabs sort recalls by stage — open, in progress, closed. " +
        "It helps you see which recalls still need work.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="recalls-search"]',
      title: "Search recalls",
      description:
        "Type a recall number, title, or car model here to find a recall quickly.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="recalls-new"]',
      title: "Click 'New recall'",
      description:
        "When the manufacturer announces a recall, click 'New recall' to log it. " +
        "This opens the recall form.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="recalls-new-dialog"]',
      title: "Fill in the recall details",
      description:
        "In this window, enter the recall number, what the fault is, and which model it affects. " +
        "Copy these details exactly from the manufacturer's notice.",
      side: "over",
      align: "center",
    },
    {
      title: "Open the new recall",
      description:
        "After you save it, click the recall's row in the list to open its detail page. " +
        "That's where you manage the affected cars.",
    },
    {
      element: '[data-tour-id="recall-detail-summary"]',
      title: "The recall summary",
      description:
        "This card shows the recall's key facts. " +
        "Check it matches the manufacturer's notice before you go further.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="recall-detail-vehicles"]',
      title: "The affected cars",
      description:
        "This card lists the cars that need the recall fix. " +
        "It starts empty — you add the affected cars next.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="recall-detail-assign"]',
      title: "Assign the affected cars",
      description:
        "Click 'Assign vehicles' to add the cars that match this recall. " +
        "Don't miss any — every affected car must get the fix.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="recall-detail-status"]',
      title: "Track the progress",
      description:
        "As the cars are repaired, update the recall's status here. " +
        "When every car is fixed, the recall can be closed.",
      side: "bottom",
      align: "start",
    },
    {
      title: "Recall handled!",
      description:
        "Done. The recall is logged, the affected cars are listed, and the work is being tracked. " +
        "Keep it updated until every car has had the fix — that's a safety matter.",
    },
  ],
};
