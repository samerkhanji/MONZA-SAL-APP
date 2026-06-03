import type { Tour } from "./types";

/**
 * Page tour: /ordered-cars.
 *
 * Trains a non-technical employee on the Ordered Cars page — tracking cars
 * that are still being shipped, receiving them with a real inspection
 * checklist when they land, and the "Awaiting PDI" gate that keeps a car
 * out of fleet-ready stock until its PDI is done. Steps that would point
 * inside the (closed) receive dialog are written as centered modal steps.
 *
 * Tone: plain English, like a colleague training a new employee.
 */
export const orderedCarsPageTour: Tour = {
  id: "page-ordered-cars-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Learn how to track inbound cars and receive them on arrival.",
  page: "/ordered-cars",
  estimatedMinutes: 4,
  steps: [
    {
      title: "Ordered Cars 👋",
      description:
        "This page tracks every car that has been ordered and is still on its way to us. When a car finally lands, you receive it here using a proper inspection checklist. Hit 'Next' to see how.",
    },
    {
      element: '[data-tour-id="ordered-cars-add"]',
      title: "Add an incoming car",
      description:
        "When a new car is ordered from the supplier, use this button to add it. You enter the VIN, brand, model, shipment code and the expected arrival date so everyone can see it is coming.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="ordered-cars-in-transit"]',
      title: "Cars on the way",
      description:
        "This list shows every car still being shipped. You can see the VIN, the vehicle, its shipment code and its expected arrival date. A car stays here until you receive it.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="ordered-cars-receive"]',
      title: "Receive a car when it arrives",
      description:
        "The moment a car physically lands at the dealership, find it in the list and click 'Receive car'. This opens the receiving inspection checklist — never skip it.",
      side: "left",
      align: "start",
    },
    {
      title: "Fill in the receiving checklist carefully",
      description:
        "The checklist asks you to confirm the VIN matches, and that the keys, documents, charger and accessories all arrived, plus that the exterior has no damage. If anything is missing or damaged, leave the box unticked and write what is wrong in the notes — the app will not let you finish until you do. This record protects the company if the supplier sent the wrong thing.",
    },
    {
      element: '[data-tour-id="ordered-cars-awaiting-pdi"]',
      title: "Awaiting PDI",
      description:
        "After a car is received it moves into this section. It is in inventory, but it is NOT fleet-ready yet — it still needs a PDI (pre-delivery inspection). A red 'Issues noted' badge means the arrival check found a problem. Open the car to record its PDI.",
      side: "top",
      align: "start",
    },
    {
      title: "That's it ✅",
      description:
        "Add cars when they are ordered, receive them with the full checklist when they land, and clear the Awaiting PDI list by completing each car's PDI. Take your time on the checklist — it is the company's proof of what really arrived. You can replay this guide anytime from the ? button in the bottom-right corner.",
    },
  ],
};
