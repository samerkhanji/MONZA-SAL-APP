import type { Tour } from "./types";

/**
 * Workflow tour: "Open and progress a warranty case".
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const warrantyCaseWorkflowTour: Tour = {
  id: "workflow-warranty-case-v1",
  kind: "workflow",
  label: "Open a warranty case",
  description: "Log a warranty claim for a car and move it through to a resolution.",
  estimatedMinutes: 6,
  allowedRoles: [
    "owner",
    "garage_manager",
    "garage_staff",
    "hybrid",
    "khalil_hybrid",
  ],
  steps: [
    {
      title: "Let's open a warranty case",
      description:
        "A customer's car has a fault that's covered by warranty. " +
        "You open a case, then move it along until it's resolved. " +
        "I'll walk you through it. Hit 'Next' to start.",
    },
    {
      navigateTo: "/garage/warranty",
      element: '[data-tour-id="nav-warranty"]',
      title: "Open Warranty",
      description:
        "This is the warranty page. Every warranty claim — new, in progress, or closed — lives here.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-new-case"]',
      title: "Click 'New case'",
      description:
        "To start a claim, click 'New case'. This opens the case form.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="warranty-new-dialog"]',
      title: "Describe the problem",
      description:
        "In this window, pick the car the claim is for. The VIN fills in automatically. " +
        "Choose the kind of warranty and write a short summary of what's wrong.",
      side: "over",
      align: "center",
    },
    {
      title: "Open the case",
      description:
        "When the form is filled in, click 'Open case'. The warranty case is created " +
        "and lands in your list.",
    },
    {
      element: '[data-tour-id="warranty-status-tabs"]',
      title: "Find the new case",
      description:
        "These tabs sort cases by status. A brand-new case starts in the first tab. " +
        "We'll open it to move it forward.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-table"]',
      title: "Open the case",
      description:
        "Click the case's row in this table to open it. " +
        "Inside is where you do the actual work.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="warranty-detail-summary"]',
      title: "Review the case",
      description:
        "This card shows the car, the customer, and what's wrong. " +
        "Read it so you know exactly what needs fixing.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-detail-status"]',
      title: "Move the case forward",
      description:
        "This dropdown is how you progress the case — from open, to in progress, to resolved. " +
        "Pick the next status as the work moves along.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="warranty-detail-parts"]',
      title: "Log parts used",
      description:
        "If the repair needed parts, record them here. This is what you claim back " +
        "under the warranty.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-detail-documents"]',
      title: "Attach documents",
      description:
        "Add photos, inspection reports, or any paperwork that backs up the claim. " +
        "Good evidence makes warranty claims go through smoothly.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="warranty-detail-resolution"]',
      title: "Record the resolution",
      description:
        "When the work is done, write down how the case was resolved here. " +
        "That closes the loop on the claim.",
      side: "top",
      align: "start",
    },
    {
      title: "Warranty case handled!",
      description:
        "Done. The case was opened, worked through, and resolved — all on record. " +
        "The customer is sorted and you have a clear history of the claim.",
    },
  ],
};
