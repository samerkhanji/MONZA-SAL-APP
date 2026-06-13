import type { Tour } from "./types";

/**
 * IT welcome tour — the IT role is technical and data-focused (no access to
 * customers, the garage, or installments). This walk-through keeps to the
 * screens IT actually uses and frames them around data integrity. Baby-feeds
 * every step. Auto-fires on first login for the IT role.
 */
export const itWelcomeTour: Tour = {
  id: "welcome-it-v1",
  kind: "welcome",
  label: "IT full tour",
  description: "Walks the IT role through the screens they manage, step by step.",
  allowedRoles: ["it"],
  steps: [
    {
      title: "Welcome 👋 You keep the data clean",
      description:
        "Hi! Your job is the health of the system — accurate records, working documents, sensible reports. In a minute I'll show you each screen you'll use. Press 'Next' to begin; replay any time from the ? button in the bottom-right.",
    },
    {
      element: '[data-tour-id="nav-data-health"]',
      navigateTo: "/data-health",
      title: "1. Data Health — start here",
      description:
        "This is your home page. It lists everything broken or missing — cars with no VIN, records with empty fields, anything that would make a report lie. Work down this list and the whole system gets more trustworthy.",
    },
    {
      element: '[data-tour-id="nav-cars"]',
      navigateTo: "/cars",
      title: "2. Cars — the records",
      description:
        "The full vehicle list. Search by VIN, plate, brand, or model. Each car is tagged EREV or Pure EV. Open a car to check or correct its details when Data Health flags it.",
    },
    {
      element: '[data-tour-id="nav-documents"]',
      navigateTo: "/documents",
      title: "3. Documents",
      description:
        "Every car's files — registration, insurance, warranty. Search by VIN. If a document is missing or access is wrong, this is where you sort it out.",
    },
    {
      element: '[data-tour-id="nav-reports"]',
      navigateTo: "/reports",
      title: "4. Reports",
      description:
        "All the numbers in chart form. Use these to sanity-check that the data adds up after a clean-up — if a chart looks wrong, the underlying records usually need fixing.",
    },
    {
      element: '[data-tour-id="nav-requests"]',
      navigateTo: "/requests",
      title: "5. Requests",
      description:
        "Some actions need approval first (deleting a record, an unusual change). You'll raise a request here and can watch whether it's approved or rejected — no guessing.",
    },
    {
      title: "That's your toolkit 🎉",
      description:
        "Data Health → fix the records → confirm in Reports. Each page has a ? button to replay its own mini-tour, and the chat assistant in the bottom-right answers any 'how do I…' question. Go ahead and explore.",
    },
  ],
};
