import type { Tour } from "./types";

/**
 * Page tour: /cars/add (Add Car form).
 *
 * Short walkthrough of the new-car form. Tone matches the owner welcome
 * tour: short, plain English, no jargon.
 */
export const carsAddPageTour: Tour = {
  id: "page-cars-add-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Add Car form.",
  page: "/cars/add",
  steps: [
    {
      element: '[data-tour-id="cars-add-vehicle-info-panel"]',
      title: "Vehicle information",
      description:
        "Start here. This card holds the basics every car needs — its VIN, brand, model, and where it lives.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-vin-input"]',
      title: "VIN",
      description:
        "Type the car's 17-character VIN, or use the scan button beside it to read the sticker with your camera.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-status-select"]',
      title: "Status",
      description:
        "Tell the system what's happening with this car — available for sale, reserved, sold, and so on.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-technical-panel"]',
      title: "Technical details",
      description:
        "Fill in the mileage and, for electric cars, the battery level. You can leave blanks and come back later.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-submit-button"]',
      title: "Add the car",
      description:
        "When the form looks right, click here to save the car into your inventory.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-cancel-button"]',
      title: "Cancel",
      description:
        "Changed your mind? Click here to leave without saving. Nothing you typed is kept.",
      side: "top",
      align: "start",
    },
  ],
};
