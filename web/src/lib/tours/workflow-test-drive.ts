import type { Tour } from "./types";

/**
 * Workflow tour: "Schedule a test drive".
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const testDriveWorkflowTour: Tour = {
  id: "workflow-test-drive-v1",
  kind: "workflow",
  label: "Schedule a test drive",
  description: "Book a customer to drive a car before they decide.",
  estimatedMinutes: 4,
  allowedRoles: [
    "owner",
    "sales_ops",
    "sales",
    "hybrid",
    "khalil_hybrid",
    "assistant",
  ],
  steps: [
    {
      title: "Let's book a test drive",
      description:
        "A customer wants to drive a car before buying? Book it here so the car is held for them " +
        "and you remember to follow up afterwards. Hit 'Next' to start.",
    },
    {
      navigateTo: "/test-drive",
      element: '[data-tour-id="nav-test-drive"]',
      title: "Open Test Drive",
      description:
        "This page handles all test drives — booking new ones and tracking the cars that are out.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-vin-panel"]',
      title: "Start with the car",
      description:
        "A test drive always begins with a car. We look the car up by its VIN, " +
        "then the system pulls up its details.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-vin-input"]',
      title: "Type the VIN",
      description:
        "Type the VIN of the car the customer wants to drive. " +
        "It's on the windshield or the driver's door sticker.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="test-drive-scan-button"]',
      title: "Or scan it",
      description:
        "Don't want to type? Click here to scan the VIN barcode with your camera instead. " +
        "Either way works.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-lookup-button"]',
      title: "Look up the car",
      description:
        "Click 'Look up'. The system finds the car and opens the booking form.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Fill in the booking",
      description:
        "Now pick the customer who's driving, choose the date and time, and add any notes. " +
        "Saving the booking holds the car for that slot so nobody double-books it.",
    },
    {
      element: '[data-tour-id="test-drive-active-panel"]',
      title: "Track active drives",
      description:
        "Every test drive currently out shows up in this list. Click 'Open' on a row " +
        "to check it or to mark the car as returned.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-returns-panel"]',
      title: "Recent returns",
      description:
        "Once a car comes back, it moves here. Open a returned drive to log how it went " +
        "and follow up with the customer — that's where deals are won.",
      side: "top",
      align: "start",
    },
    {
      title: "Test drive booked!",
      description:
        "That's it. The car is reserved for the customer, and you'll see the drive in the " +
        "active list. Don't forget to follow up after they return.",
    },
  ],
};
