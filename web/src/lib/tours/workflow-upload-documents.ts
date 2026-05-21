import type { Tour } from "./types";

/**
 * Workflow tour: "Upload and link a document".
 *
 * Attaching paperwork — registration, invoices, photos — to the right car.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const uploadDocumentsWorkflowTour: Tour = {
  id: "workflow-upload-documents-v1",
  kind: "workflow",
  label: "Upload a document",
  description: "Attach paperwork to the right car so the team can find it.",
  estimatedMinutes: 4,
  steps: [
    {
      title: "Let's upload a document",
      description:
        "Paperwork — registration, invoices, photos — belongs with the car it's about. " +
        "This tour shows you how to upload it and link it correctly. Hit 'Next' to start.",
    },
    {
      navigateTo: "/documents",
      element: '[data-tour-id="nav-documents"]',
      title: "Open Documents",
      description:
        "This is the Documents page. It's where all the car paperwork is stored and searched.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="documents-search-panel"]',
      title: "Start with the car",
      description:
        "Documents are linked to a car. So first you find the car — then you add or view its files.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="documents-vin-search-input"]',
      title: "Type the car's VIN",
      description:
        "Type the car's VIN here. The VIN is the car's unique number — it makes sure the document " +
        "goes on the right vehicle.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="documents-scan-vin-button"]',
      title: "Or scan the VIN",
      description:
        "Don't want to type it? Click this button to scan the VIN with your camera instead. " +
        "Faster and no typing mistakes.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="documents-search-button"]',
      title: "Find the car",
      description:
        "Click 'Search' to pull up the car. Once it's found, you'll see its documents " +
        "and a place to add new ones.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Upload the file",
      description:
        "With the car open, choose the file from your device to upload it. " +
        "Give it a clear name so the team knows what it is — for example 'registration' or 'sale invoice'.",
    },
    {
      title: "Check the file before you save",
      description:
        "Avoid this mistake: make sure you're on the right car and the file is the correct one. " +
        "A document filed on the wrong vehicle is very hard to find later.",
    },
    {
      title: "Document uploaded!",
      description:
        "Done. The file is now attached to the car and anyone who needs it can find it by VIN. " +
        "No more lost paperwork.",
    },
  ],
};
