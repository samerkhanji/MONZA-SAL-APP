import type { Tour } from "./types";

/**
 * Owner welcome tour — the most comprehensive. Walks through every major area
 * of the app as if explaining to someone who's never seen a CRM before.
 *
 * Tone: short sentences, plain English, no jargon. Imagine you're explaining
 * to a smart 12-year-old. No "leverage", "synergize", or "module" — just
 * "click this to see X" / "this is where X lives".
 *
 * In v2 this is the owner's "welcome" tour — the one auto-fired on first
 * login. Per-page and workflow tours live in separate files.
 *
 * Each section step carries a `navigateTo` so the runner actually opens the
 * page it's describing (then highlights that page's sidebar entry), instead of
 * narrating every page while stuck on whichever one you started from.
 */
export const ownerWelcomeTour: Tour = {
  id: "owner-v1",
  kind: "welcome",
  label: "Owner full tour",
  description: "Walks you through every section of the system, top to bottom.",
  allowedRoles: ["owner"],
  steps: [
    {
      title: "Welcome to Monza App 👋",
      description:
        "Hi! I'm going to walk you through your dealership in about 2 minutes. " +
        "I'll point at each thing on the screen and tell you what it does. " +
        "Hit 'Next' to start, or close this window to skip — you can replay it anytime from the ? button in the bottom-right corner.",
    },
    {
      title: "How it all connects 🔗",
      description:
        "Before the map, the story. A car arrives → it sits in your Inventory (incoming ones wait on Ordered Cars). A buyer shows interest → they become a Customer (a lead). Book a Test Drive, then create a Sales Order to sell — that turns the lead into a buyer and marks the car sold. Money paid over time lives in Installments. When any car needs service it becomes a Garage job, which pulls Parts from your stock. Everything rolls up into Reports and your Owner Overview. That's the whole loop — the rest of this tour walks you to each stop.",
      type: "section",
    },
    {
      element: '[data-tour-id="nav-dashboard"]',
      navigateTo: "/dashboard",
      title: "Your Dashboard",
      description:
        "This is your home page. The big numbers at a glance — how many cars you have, how many were sold, who's pending payment. Open it first thing in the morning.",
    },
    {
      element: '[data-tour-id="nav-dashboard-overview"]',
      navigateTo: "/dashboard/overview",
      title: "Owner Overview",
      description:
        "Only you see this page. It's the full picture — sales this month, the cash drawer, the garage, top sales rep, everything in one screen. " +
        "Click here when you want the 30-second 'how is the business doing right now' answer.",
    },
    {
      element: '[data-tour-id="nav-cars"]',
      navigateTo: "/cars",
      title: "Inventory",
      description:
        "Every car physically with you — for sale, sold, at a sub-dealer, in the garage. Cars still on the way (ordered, not arrived) live on the separate Ordered Cars page, not here. " +
        "Each car is tagged EREV or Pure EV. Use 'Add Car' when a vehicle arrives; click any row for that car's full story.",
    },
    {
      element: '[data-tour-id="nav-customers"]',
      navigateTo: "/customers",
      title: "Customers",
      description:
        "Everyone who's talked to you about buying — and everyone you've sold to. Tabs split them into buyers (Sold Cars), sub-dealer holders, and leads to follow up. Remember: one customer can hold several cars, so the people count and car count differ. " +
        "Add new leads here. Click a customer to see what they bought, what they owe, and every message you've exchanged.",
    },
    {
      element: '[data-tour-id="nav-test-drive"]',
      navigateTo: "/test-drive",
      title: "Test Drives",
      description:
        "When a customer wants to drive a car before deciding, book it here. " +
        "It blocks the car so two people don't show up at the same time, and reminds you to follow up afterwards.",
    },
    {
      element: '[data-tour-id="nav-sales-orders"]',
      navigateTo: "/sales-orders",
      title: "Sales Orders",
      description:
        "When a customer commits to buying, you create a sales order. " +
        "It's the contract for the deal — car, customer, payment plan, delivery date. Once delivered, it counts as a sale.",
    },
    {
      element: '[data-tour-id="nav-installments"]',
      navigateTo: "/installments",
      title: "Installments",
      description:
        "When a customer pays in pieces (not all at once), every monthly payment is tracked here. " +
        "You'll see who's paid, who's late, and who's coming up. Click 'Mark Paid' when money comes in.",
    },
    {
      element: '[data-tour-id="nav-trade-ins"]',
      navigateTo: "/trade-ins",
      title: "Trade-ins",
      description:
        "When a customer trades their old car in for a new one, log the appraisal here. " +
        "Once you agree on a value, the trade-in is recorded against the deal.",
    },
    {
      element: '[data-tour-id="nav-cash"]',
      navigateTo: "/cash",
      title: "Cash Register",
      description:
        "Your daily till. Whoever opens the drawer in the morning starts a 'session'. " +
        "Every cash payment, refund, or expense gets logged. At end of day, the system checks that the actual cash matches what should be there.",
    },
    {
      element: '[data-tour-id="nav-accessories"]',
      navigateTo: "/accessories",
      title: "Accessories",
      description:
        "Mats, dash cams, tinting, ceramic coating — anything you sell on top of the car itself. Track what's in stock and what packages you offer.",
    },
    {
      element: '[data-tour-id="nav-garage"]',
      navigateTo: "/garage",
      title: "The Garage",
      description:
        "Everything that happens in your service bays — jobs in progress, each mechanic's tasks, warranty claims, recalls, and your Parts store. " +
        "Parts can be viewed three ways (by part, by shelf location, or as totals with a reorder list), and jobs pull parts straight from that stock. " +
        "Hover this menu to see all the sub-pages — there are about 10.",
    },
    {
      element: '[data-tour-id="nav-documents"]',
      navigateTo: "/documents",
      title: "Documents",
      description:
        "Need a car's registration, insurance certificate, or warranty paper? Search by VIN and pull it up. " +
        "Anyone in the team can request a document; you approve who gets to see what.",
    },
    {
      element: '[data-tour-id="nav-reports"]',
      navigateTo: "/reports",
      title: "Reports",
      description:
        "All your numbers, in chart form. Who's selling the most, how fast the garage finishes jobs, who owes you money. " +
        "Click any chart to drill into the details.",
    },
    {
      element: '[data-tour-id="nav-data-health"]',
      navigateTo: "/data-health",
      title: "Data Health",
      description:
        "Cars without VINs, customers without phone numbers, jobs with no notes — anything missing or broken in your data shows up here. " +
        "Clean it up so reports don't lie to you.",
    },
    {
      element: '[data-tour-id="nav-requests"]',
      navigateTo: "/requests",
      title: "Requests",
      description:
        "If anyone on your team needs approval for something — a refund, deleting a record, an unusual action — it lands here. " +
        "You'll see 'urgent' ones in red. Click to approve, reject, or ask for more info.",
    },
    {
      element: '[data-tour-id="nav-settings"]',
      navigateTo: "/settings",
      title: "Settings",
      description:
        "Your control panel. Add employees, change someone's role, set approval thresholds (e.g. 'refunds over $500 need my OK'), change company info, view the audit log. " +
        "Only you and people you trust should be in here.",
    },
    {
      title: "That's the tour! 🎉",
      description:
        "You've seen the main map of the app. Now go click around — every page has its own buttons and forms, and most explain themselves. " +
        "Need a refresher? Click your avatar in the top-right and hit 'Take the tour' anytime. " +
        "Need help with a specific button? Use the chat assistant in the bottom-right corner — ask it anything.",
    },
  ],
};
