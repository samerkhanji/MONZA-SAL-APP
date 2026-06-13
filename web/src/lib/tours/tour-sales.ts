import type { Tour } from "./types";

/**
 * Sales welcome tour — the employee equivalent of the owner walk-through, but
 * scoped to what a salesperson does all day and written to baby-feed every
 * step. Auto-fires on first login for sales roles.
 *
 * Tone: short sentences, plain English, numbered micro-steps. Assume the
 * person has never used a computer system like this before.
 */
export const salesWelcomeTour: Tour = {
  id: "welcome-sales-v1",
  kind: "welcome",
  label: "Sales full tour",
  description: "Walks a salesperson through the whole job, step by step.",
  allowedRoles: ["sales", "sales_ops", "hybrid", "khalil_hybrid"],
  steps: [
    {
      title: "Welcome 👋 Let's learn your tools",
      description:
        "Hi! In a couple of minutes I'll walk you through everything you do here — finding a car, adding a customer, booking a test drive, and making the sale. I'll point at each screen and tell you exactly what to click. Press 'Next' to begin. You can replay this any time from the ? button in the bottom-right corner.",
    },
    {
      title: "How your day flows 🔗",
      description:
        "Here's the whole job in one breath: a customer comes in → you find them a Car → you save them as a Customer (a 'lead') → you book a Test Drive → when they say yes you make a Sales Order (that's the sale) → if they pay monthly you track it in Installments. That's it. The next steps show you each screen, one at a time.",
      type: "section",
    },
    {
      element: '[data-tour-id="nav-cars"]',
      navigateTo: "/cars",
      title: "1. Cars — your stock",
      description:
        "This is every car you can sell. To find one: type the model, color, or VIN in the search box at the top, or use the filters. Each car is tagged EREV or Pure EV. Click any row to open that car and see its photos, price info, and history.",
    },
    {
      element: '[data-tour-id="nav-ordered-cars"]',
      navigateTo: "/ordered-cars",
      title: "2. Cars on the way",
      description:
        "Cars you've ordered but haven't arrived yet live here (not in the main stock list). If a customer wants something you don't have on the floor, check here for what's coming and when — the ETA is shown for each.",
    },
    {
      element: '[data-tour-id="nav-customers"]',
      navigateTo: "/customers",
      title: "3. Customers — save every person",
      description:
        "The moment someone shows interest, add them: click 'Add Customer' (top-right), type their name and phone, and save. Now you'll never lose them. The tabs at the top split people into Sold Cars (buyers), Sub Dealer (cars held at partners), and Leads (people to chase). Click any person to see everything about them.",
    },
    {
      element: '[data-tour-id="nav-test-drive"]',
      navigateTo: "/test-drive",
      title: "4. Test Drives — book the drive",
      description:
        "Customer wants to try the car first? Book it here: pick the car, pick the customer, pick the time. This 'reserves' the car so two people don't show up for the same one, and it reminds you to call them afterwards. Always book it — it's how you remember to follow up.",
    },
    {
      element: '[data-tour-id="nav-sales-orders"]',
      navigateTo: "/sales-orders",
      title: "5. Sales Orders — make the sale",
      description:
        "This is where a sale becomes real. To sell a car: (1) click 'New Sales Order', (2) choose the customer, (3) choose the car, (4) set the delivery date and any deposit, (5) save. The second you save, the car is marked SOLD and that person becomes a buyer. Don't create one until the customer has actually committed.",
    },
    {
      element: '[data-tour-id="nav-installments"]',
      navigateTo: "/installments",
      title: "6. Installments — track the money",
      description:
        "If the customer pays monthly instead of all at once, every payment shows here. You'll see who has paid, who is late (in red), and who is due soon. When money comes in, find the row and click 'Mark Paid'. Check this page at the start of each week so nobody slips.",
    },
    {
      element: '[data-tour-id="nav-trade-ins"]',
      navigateTo: "/trade-ins",
      title: "7. Trade-ins (if they have an old car)",
      description:
        "If the customer is giving you their old car as part of the deal, log it here: record the car and the value you agreed. Once saved, it's attached to their deal. Skip this if there's no trade-in.",
      requiredCapabilities: ["sales"],
    },
    {
      element: '[data-tour-id="nav-documents"]',
      navigateTo: "/documents",
      title: "8. Documents — find the papers",
      description:
        "Need a car's registration, insurance, or warranty paper? Search by VIN here and open it. If you can't see a document you need, you can request access — the owner approves it.",
    },
    {
      element: '[data-tour-id="nav-requests"]',
      navigateTo: "/requests",
      title: "9. Requests — when you need a yes",
      description:
        "Some things need the owner's approval first — a big discount, deleting a record, an unusual refund. When that happens you'll submit a request here, and you can watch its status (waiting, approved, rejected). No guessing — you'll always know where it stands.",
    },
    {
      title: "That's your job, end to end 🎉",
      description:
        "You've seen the full path: Car → Customer → Test Drive → Sales Order → Installments. Every page has a little ? button to replay its own mini-tour, and the chat assistant in the bottom-right can answer any 'how do I…' question. Go ahead and click around — you can't break anything.",
    },
  ],
};
