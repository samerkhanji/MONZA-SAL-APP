import type { Tour } from "./types";

/**
 * Page tour: /test-drive.
 *
 * Walks through starting a test drive by VIN and managing active / returned
 * outings. Tone matches the owner welcome tour: short, plain English.
 */
export const testDrivePageTour: Tour = {
  id: "page-test-drive-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Test Drive page.",
  page: "/test-drive",
  steps: [
    {
      element: '[data-tour-id="test-drive-vin-panel"]',
      title: "Start a test drive",
      description:
        "Everything starts here. To take a car out, first tell the system which car by its VIN.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-vin-input"]',
      title: "VIN box",
      description:
        "Type the car's 17-character VIN here. It's the long code on the windshield or door frame.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-scan-button"]',
      title: "Scan instead",
      description:
        "Don't want to type the VIN? Click here to scan it with your camera — quicker and no typos.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="test-drive-lookup-button"]',
      title: "Look up the car",
      description:
        "After entering the VIN, click this. The system finds the car and opens the form to book the test drive.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="test-drive-active-panel"]',
      title: "Active test drives",
      description:
        "Every car currently out on a test drive. Check this so you know which cars are away from the lot right now.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-active-open-button"]',
      title: "Open an active drive",
      description:
        "Click this to see the details of a car that's out — and to mark it returned when it comes back.",
      side: "left",
      align: "center",
    },
    {
      element: '[data-tour-id="test-drive-returns-panel"]',
      title: "Recent returns",
      description:
        "The last test drives that have finished. A quick way to follow up with customers who just drove a car.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="test-drive-returns-view-button"]',
      title: "View a return",
      description:
        "Click this to look back at a finished test drive — who drove it, when, and any notes left behind.",
      side: "left",
      align: "center",
    },
  ],
};
