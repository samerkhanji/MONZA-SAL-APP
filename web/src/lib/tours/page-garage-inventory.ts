import type { Tour } from "./types";

/**
 * Page tour: /garage/inventory (Parts).
 *
 * Plain-English walkthrough of the parts store. A "part" is a spare piece for
 * a car — a filter, a brake pad, a headlight. "Stock" means how many you have
 * on the shelf right now.
 */
export const garageInventoryPageTour: Tour = {
  id: "page-garage-inventory-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through every button on the Parts Inventory page.",
  page: "/garage/inventory",
  steps: [
    {
      element: '[data-tour-id="inventory-add-part"]',
      title: "Add New Part",
      description:
        "Click here to put a new spare part on the shelf. You give it a name, a part number, how many you have, and where it's stored.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="inventory-import"]',
      title: "Import from Excel",
      description:
        "Got a long list of parts in a spreadsheet? Upload it here and the system adds them all at once, instead of typing each one.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="inventory-export"]',
      title: "Export",
      description:
        "Downloads the parts list as a spreadsheet — handy for stock-taking or sending to someone.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="inventory-refresh"]',
      title: "Refresh",
      description:
        "Reloads the list to show the very latest numbers — useful if a workmate just added or used a part.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="inventory-search"]',
      title: "Search box",
      description:
        "Type a part name or part number to find one item fast instead of scrolling the whole list.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-scan-part"]',
      title: "Scan a part",
      description:
        "Point your camera at a part's barcode and the system jumps straight to it. Quicker than typing the long part number.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-supplier-filter"]',
      title: "Filter by supplier",
      description:
        "Show only parts bought from one supplier. Use it when you want to see what came from a particular shop.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-status-filter"]',
      title: "Filter by stock level",
      description:
        "Show only parts that are in stock, low, or out. Pick 'Low or Out' to see exactly what you need to re-order.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-low-stock-banner"]',
      title: "Low-stock warning",
      description:
        "This yellow bar appears when parts are running low or have run out. Click it to instantly filter the list down to just those parts so you can order more.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-table"]',
      title: "The parts table",
      description:
        "Every part you stock, with how many you have, where it lives, and what it costs. Quantities turn red when a part runs out and amber when it's low.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="inventory-row-actions"]',
      title: "Row actions menu",
      description:
        "The three-dots button on each row. Open it to add stock when parts arrive, take stock out when you use a part, edit the part's details, see its history, or delete it.",
      side: "left",
      align: "start",
    },
  ],
};
