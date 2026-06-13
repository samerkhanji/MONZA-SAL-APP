import type { Tour } from "./types";

/**
 * Garage welcome tour — the employee walk-through for mechanics and the garage
 * manager. Scoped to the service side and written to baby-feed every step.
 * Auto-fires on first login for garage roles.
 */
export const garageWelcomeTour: Tour = {
  id: "welcome-garage-v1",
  kind: "welcome",
  label: "Garage full tour",
  description: "Walks garage staff through the whole job, step by step.",
  allowedRoles: ["garage_manager", "garage_staff"],
  steps: [
    {
      title: "Welcome 👋 Here's your workshop on screen",
      description:
        "Hi! In a couple of minutes I'll show you everything you use in the garage — your jobs, your tasks, and the parts shelf. I'll point at each screen and tell you exactly what to click. Press 'Next' to begin; replay any time from the ? button in the bottom-right.",
    },
    {
      title: "How your day flows 🔗",
      description:
        "The whole job in one breath: a car comes in for service → it becomes a Job → the job is split into Tasks for the mechanics → you pull the Parts you need from the shelf → you update the status as you go → when it's finished you mark it done. The next steps walk you to each screen.",
      type: "section",
    },
    {
      element: '[data-tour-id="nav-garage"]',
      navigateTo: "/garage",
      title: "1. Jobs — what's in the shop",
      description:
        "Every car being worked on right now. Each card is one job. Click a job to open it: inside you'll see the car, what needs doing, the parts used, and the status. This is your main screen — start here every morning.",
    },
    {
      element: '[data-tour-id="nav-garage-tasks"]',
      navigateTo: "/garage/tasks",
      title: "2. Tasks — your to-do list",
      description:
        "A job is made of smaller tasks (e.g. 'change brake pads', 'oil service'). This page shows the tasks assigned to you. To work one: (1) open the task, (2) press Start when you begin, (3) press Done when you finish. The manager can see progress live, so keep it updated.",
    },
    {
      element: '[data-tour-id="nav-parts"]',
      navigateTo: "/garage/inventory",
      title: "3. Parts — the shelf",
      description:
        "Every spare part you stock. Three ways to look: By Part Number (search one part), By Location (walk the shelves — it shows what sits on each shelf), and Totals (the big picture + a 'to reorder' list). To take a part for a job: find it, open the three-dot menu, and choose 'Stock Out' — that lowers the count so the shelf number stays correct.",
    },
    {
      element: '[data-tour-id="nav-ordered-parts"]',
      navigateTo: "/ordered-parts",
      title: "4. Parts on order",
      description:
        "Parts you've ordered but haven't received yet show here. When a box arrives, mark it received and the quantity is added to the shelf automatically. Check this when a part you need says it's out of stock.",
    },
    {
      element: '[data-tour-id="nav-warranty"]',
      navigateTo: "/garage/warranty",
      title: "5. Warranty claims",
      description:
        "If a repair is covered by the manufacturer's warranty, open a warranty case here so the cost goes back to the maker, not the customer. Attach the parts used and the paperwork.",
    },
    {
      element: '[data-tour-id="nav-recalls"]',
      navigateTo: "/garage/recalls",
      title: "6. Recalls",
      description:
        "When the maker recalls a model for a fix, the affected cars are tracked here. As each car comes in and gets the fix, mark it done so you know which cars are still outstanding.",
    },
    {
      element: '[data-tour-id="nav-requests"]',
      navigateTo: "/requests",
      title: "7. Requests — when you need a yes",
      description:
        "Some actions need approval first (deleting a record, an unusual refund). You'll raise a request here and can watch whether it's approved or rejected — no guessing.",
    },
    {
      title: "That's the garage, end to end 🎉",
      description:
        "You've seen the path: Job → Tasks → Parts → Done. Every page has a ? button to replay its own mini-tour, and the chat assistant in the bottom-right answers any 'how do I…' question. Go ahead and explore — you can't break anything.",
    },
  ],
};
