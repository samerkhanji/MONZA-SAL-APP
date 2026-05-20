import type { Tour } from "./types";

/**
 * Page tour: /cars (Car Inventory).
 *
 * Walks through every button on the inventory list — adding cars, searching,
 * filtering, and the per-row actions menu. Tone matches the owner welcome
 * tour: short sentences, plain English, no jargon.
 */
export const carsPageTour: Tour = {
  id: "page-cars-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Inventory page.",
  page: "/cars",
  steps: [
    {
      element: '[data-tour-id="cars-list-add-button"]',
      title: "Add a car",
      description:
        "Click here whenever a new vehicle arrives at the dealership. It opens a form where you type in the car's details.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="cars-list-import-excel-button"]',
      title: "Import from Excel",
      description:
        "Got a whole spreadsheet of cars? Upload it here and the system adds them all at once, instead of typing each one by hand.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="cars-list-filters-panel"]',
      title: "Filters",
      description:
        "This box holds all the ways to narrow down the list. Use it when you have a lot of cars and want to find a few quickly.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-search-input"]',
      title: "Search box",
      description:
        "Type a VIN, plate, brand, or model to jump straight to a car. The list shrinks as you type.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-scan-vin-button"]',
      title: "Scan a VIN",
      description:
        "Don't want to type the long VIN? Click this and use your camera to scan the VIN sticker on the car instead.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-filter-status"]',
      title: "Filter by status",
      description:
        "Show only cars that are available, sold, in the garage, and so on. Pick a status to hide everything else.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-filter-location"]',
      title: "Filter by location",
      description:
        "If you keep cars in more than one place, use this to see only the cars at one lot or showroom.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-filter-brand"]',
      title: "Filter by brand",
      description:
        "Want to see only Toyotas, or only BMWs? Pick a brand here and the rest disappear from the list.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-table-panel"]',
      title: "The car list",
      description:
        "Every car you own, one per row. Click any row to open that car's full profile — its history, documents, and sale details.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-row-actions-trigger"]',
      title: "Row actions menu",
      description:
        "The three-dots button on each row. Click it for quick actions on that car without opening the full profile.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-row-actions-view"]',
      title: "View profile",
      description:
        "Opens the car's full page — everything you know about that vehicle in one place.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-row-actions-documents"]',
      title: "Documents and PDFs",
      description:
        "Jumps straight to that car's papers — registration, insurance, warranty, and any PDFs you've saved.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-row-actions-edit"]',
      title: "Edit the car",
      description:
        "Fix a typo or update a detail — price, color, mileage — without leaving the list.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-row-actions-move"]',
      title: "Move the car",
      description:
        "Use this when a car physically moves to a different lot or showroom, so the system always knows where it is.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour-id="cars-list-row-actions-scrap"]',
      title: "Scrap the car",
      description:
        "Only for cars that are written off for good. This is permanent, so the system asks for a password before it lets you do it.",
      side: "left",
      align: "start",
    },
  ],
};
