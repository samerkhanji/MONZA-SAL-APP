import type { Tour } from "./types";

/**
 * Workflow tour: "Sell a car".
 *
 * A car is sold by opening that car's profile and giving it a buyer, which
 * creates a sales order. The sales order then walks through its lifecycle:
 * quote -> deposit -> delivered.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const sellCarWorkflowTour: Tour = {
  id: "workflow-sell-car-v1",
  kind: "workflow",
  label: "Sell a car",
  description: "From inventory to delivered — create a sales order and close the deal.",
  estimatedMinutes: 8,
  allowedRoles: ["owner", "sales_ops", "sales", "hybrid", "khalil_hybrid"],
  steps: [
    {
      title: "Let's sell a car",
      description:
        "A customer wants to buy. I'll show you how to turn that into a real sale, " +
        "from picking the car to handing over the keys. Hit 'Next' to begin.",
    },
    {
      navigateTo: "/cars",
      element: '[data-tour-id="nav-cars"]',
      title: "Start in Inventory",
      description:
        "Every sale starts with a car. We go to Inventory first to find the one the customer wants.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-search-input"]',
      title: "Find the car",
      description:
        "Type the VIN, plate, brand, or model to find the exact car the customer chose. " +
        "Search for it now.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="cars-list-table-panel"]',
      title: "Open the car",
      description:
        "Click the car's row in this table to open its profile. That's where we mark it sold.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      title: "Edit the car",
      description:
        "On the car's profile, click 'Edit' in the top-right. In the edit window you'll change the status " +
        "to 'reserved' or 'sold' and attach the buyer. Saving that creates the sales order.",
    },
    {
      title: "Set the buyer and status",
      description:
        "In the edit window, change the status to 'reserved' or 'sold', then pick the customer " +
        "(or add a new one). Click Save when you're done — " +
        "the system creates a sales order for this deal.",
    },
    {
      navigateTo: "/sales-orders",
      element: '[data-tour-id="nav-sales-orders"]',
      title: "Go to Sales Orders",
      description:
        "Now we open Sales Orders. Your new deal is waiting here as an order to work through.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="sales-orders-list-search-input"]',
      title: "Find your order",
      description:
        "Search by the customer's name, phone, or the car to find the order you just created.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      element: '[data-tour-id="sales-orders-list-table-panel"]',
      title: "Open the order",
      description: "Click the order's row to open it. This is the deal's home page.",
      side: "top",
      align: "start",
      waitFor: "click",
    },
    {
      title: "The deal's progress bar",
      description:
        "Inside a sales order you'll see a strip at the top with every stage of the sale — " +
        "quote, deposit, delivery. As you complete each step, it lights up. " +
        "Your job is to move it all the way to the end.",
    },
    {
      title: "Save the quote",
      description:
        "First, record that the quote was sent to the customer. " +
        "Fill in the numbers in the quote section, then click 'Save quote'.",
    },
    {
      title: "Record the deposit",
      description:
        "When the customer pays a deposit to hold the car, record it in the deposit section. " +
        "Enter the amount and click 'Save deposit'.",
    },
    {
      title: "Mark it delivered",
      description:
        "When the customer collects the car and the deal is fully paid, scroll down to the " +
        "Delivery section and click 'Mark delivered'. That's the final step — it counts the sale " +
        "and marks the customer as a buyer.",
    },
    {
      title: "Sale complete!",
      description:
        "Nice work. The car is sold, the customer is recorded as a buyer, and the deal shows up " +
        "in your reports. Repeat this flow for every sale.",
    },
  ],
};
