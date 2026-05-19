import type { Tour } from "./types";

/**
 * Workflow tour: "Add your first car".
 *
 * STATUS: skeleton — the structure is real (navigateTo + waitFor wired up)
 * but the copy is placeholder. Phase-2 content agent: rewrite the title /
 * description fields in plain English, like the owner welcome tour.
 *
 * Designed to exercise every interactive-mode feature:
 *   - `navigateTo` on multiple steps (router pushes between pages)
 *   - `waitFor: "click"`  — user has to actually click the highlighted button
 *   - `waitFor: "input"`  — user has to actually type into a field
 *   - `waitFor: "navigation"` — user has to navigate (e.g. submit a form)
 */
export const addCarWorkflowTour: Tour = {
  id: "workflow-add-car-v1",
  kind: "workflow",
  label: "Add your first car",
  description: "Hands-on. I'll walk you through the whole flow.",
  estimatedMinutes: 5,
  // Allow everyone who can add a car. Leave empty to let the launcher decide.
  allowedRoles: ["owner", "sales_ops", "sales", "hybrid", "khalil_hybrid"],
  steps: [
    {
      // Step 1 — kickoff modal, no element.
      title: "Let's add your first car",
      description:
        "PLACEHOLDER: I'll guide you through every step. In interactive mode, " +
        "you'll actually do the work — I just point. Ready?",
    },
    {
      // Step 2 — go to Inventory.
      navigateTo: "/cars",
      element: '[data-tour-id="nav-cars"]',
      title: "Go to Inventory",
      description: "PLACEHOLDER: This is where every car lives.",
      side: "right",
      align: "start",
    },
    {
      // Step 3 — click "Add Car".
      element: '[data-tour-id="cars-add-button"]',
      title: "Click 'Add Car'",
      description: "PLACEHOLDER: Tap the Add Car button.",
      side: "bottom",
      align: "start",
      waitFor: "click",
    },
    {
      // Step 4 — fills VIN.
      navigateTo: "/cars/add",
      element: '[data-tour-id="car-form-vin"]',
      title: "Enter the VIN",
      description:
        "PLACEHOLDER: 17 characters, on the windshield or driver's door jamb.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      // Step 5 — type the make.
      element: '[data-tour-id="car-form-make"]',
      title: "Make",
      description: "PLACEHOLDER: Toyota, BMW, etc.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      // Step 6 — model.
      element: '[data-tour-id="car-form-model"]',
      title: "Model",
      description: "PLACEHOLDER: Corolla, X5, etc.",
      side: "right",
      align: "start",
      waitFor: "input",
    },
    {
      // Step 7 — submit.
      element: '[data-tour-id="car-form-submit"]',
      title: "Save it",
      description:
        "PLACEHOLDER: Hit Save. We'll land back on the inventory list once it's in.",
      side: "top",
      align: "end",
      waitFor: "navigation",
    },
    {
      // Step 8 — done modal.
      title: "Nice — you added a car!",
      description:
        "PLACEHOLDER: That's it. Any time a new vehicle arrives, repeat these steps.",
    },
  ],
};
