import type { Tour } from "./types";

/**
 * Workflow tour: "Add your first car".
 *
 * Cross-page, hands-on. In interactive mode the user actually clicks the
 * buttons and types into the fields — the tour just points and waits.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const addCarWorkflowTour: Tour = {
  id: "workflow-add-car-v1",
  kind: "workflow",
  label: "Add a car to inventory",
  description: "Hands-on. I'll walk you through adding a new car, start to finish.",
  estimatedMinutes: 5,
  allowedRoles: ["owner", "sales_ops", "sales", "hybrid", "khalil_hybrid"],
  steps: [
    {
      title: "Let's add a car",
      description:
        "A new vehicle arrived? Great. I'll walk you through putting it into the system. " +
        "I'll point at each button — you do the clicking. Hit 'Next' when you're ready.",
    },
    {
      navigateTo: "/cars",
      element: '[data-tour-id="nav-cars"]',
      title: "Open Inventory",
      description:
        "First we go to Inventory. This is the list of every car you own. " +
        "I've opened it for you — that highlighted item in the menu is how you get here yourself next time.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-add-button"]',
      title: "Click 'Add Car'",
      description:
        "This button starts a blank car record. Click it now to open the form.",
      side: "bottom",
      align: "end",
      waitFor: "click",
    },
    {
      navigateTo: "/cars/add",
      element: '[data-tour-id="cars-add-vehicle-info-panel"]',
      title: "The car form",
      description:
        "This is where you describe the car. We'll fill in the important bits together. " +
        "Don't worry — you can always edit a car later.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-vin-input"]',
      title: "Type the VIN",
      description:
        "The VIN is the car's unique 17-character code. You'll find it on the windshield " +
        "or the sticker inside the driver's door. Type it in now.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="cars-add-brand-select"]',
      title: "Pick the brand",
      description:
        "Click here and choose the make — Toyota, BMW, Mercedes, and so on.",
      side: "right",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cars-add-model-input"]',
      title: "Type the model",
      description: "Now the model name — Corolla, X5, C-Class. Type it in.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="cars-add-location-select"]',
      title: "Where is the car?",
      description:
        "Pick where the car physically sits right now — the showroom, the yard, in transit. " +
        "This helps everyone find it later.",
      side: "right",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cars-add-status-select"]',
      title: "Set the status",
      description:
        "The status says where the car is in its life: arriving, available for sale, reserved, sold. " +
        "For a fresh arrival, leave it as the default or pick 'available'.",
      side: "right",
      align: "start",
      waitFor: "click",
    },
    {
      element: '[data-tour-id="cars-add-technical-panel"]',
      title: "Technical details",
      description:
        "Mileage, battery health, and other specs go here. Fill in what you know — " +
        "you can skip anything you don't have yet.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-add-submit-button"]',
      title: "Save the car",
      description:
        "All set? Click 'Add Car'. The system saves it and takes you back to the inventory list.",
      side: "top",
      align: "end",
      waitFor: "navigation",
    },
    {
      title: "Done — the car is in!",
      description:
        "That's it. Your new car is now in inventory and everyone on the team can see it. " +
        "Each time a vehicle arrives, just repeat these steps.",
    },
  ],
};
