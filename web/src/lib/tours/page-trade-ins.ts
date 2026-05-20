import type { Tour } from "./types";

/**
 * Page tour: /trade-ins.
 *
 * Walks through the trade-in list, status tabs, and the "request trade-in"
 * form. Tone matches the owner welcome tour: short, plain English, no jargon.
 */
export const tradeInsPageTour: Tour = {
  id: "page-trade-ins-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Trade-ins page.",
  page: "/trade-ins",
  steps: [
    {
      element: '[data-tour-id="trade-ins-list-request-button"]',
      title: "Request a trade-in",
      description:
        "When a customer wants to hand in their old car as part of a deal, click here to start the process.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="trade-ins-list-status-tabs"]',
      title: "Status tabs",
      description:
        "A trade-in moves through stages. These tabs let you see them by stage — waiting to be inspected, inspected, approved, and so on.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-list-search-input"]',
      title: "Search box",
      description:
        "Type a trade-in number, vehicle, VIN, or customer name to find one quickly.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-list-request-dialog"]',
      title: "The request form",
      description:
        "This window collects the old car's details and a first-guess value. The garage will inspect it later, and the owner approves the final price.",
      side: "over",
      align: "center",
    },
    {
      element: '[data-tour-id="trade-ins-request-customer-select"]',
      title: "Pick the customer",
      description:
        "Choose the customer who is offering their car. The trade-in is tied to that person.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-request-make-input"]',
      title: "Car make",
      description:
        "Type the brand of the old car, like Toyota or Honda.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-request-model-input"]',
      title: "Car model",
      description:
        "Type the model of the old car, like Camry or Civic.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-request-provisional-input"]',
      title: "Provisional value",
      description:
        "Your rough first estimate of what the old car is worth. It's not final — the garage checks the car and the owner sets the real price.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-request-cancel"]',
      title: "Cancel",
      description:
        "Close this form without creating a trade-in. Use it if you change your mind.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="trade-ins-request-submit"]',
      title: "Submit request",
      description:
        "Sends the trade-in to the garage for inspection. After this, the team takes it from here.",
      side: "top",
      align: "end",
    },
  ],
};
