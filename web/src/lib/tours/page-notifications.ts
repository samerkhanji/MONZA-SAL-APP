import type { Tour } from "./types";

/**
 * Page tour: /notifications.
 *
 * The notifications inbox — every alert, mention, and approval the system has
 * sent you, in one place.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const notificationsPageTour: Tour = {
  id: "page-notifications-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through your notifications inbox.",
  page: "/notifications",
  steps: [
    {
      title: "Your notifications 🔔",
      description:
        "This is your inbox. Every alert the system sends you lands here — someone mentioned you, a request needs your approval, a job changed status. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="notifications-tabs"]',
      title: "Filter tabs",
      description:
        "Sort your inbox by type. 'Unread' shows what you haven't looked at yet, 'Critical' shows the urgent ones, " +
        "and the rest split things into approvals, mentions, alerts, and so on.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="notifications-search-input"]',
      title: "Search",
      description:
        "Remember a notification but can't find it? Type a word from its title or message here to search through everything.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="notifications-mark-all-read"]',
      title: "Mark all read",
      description:
        "One click clears every unread notification. Handy when you've caught up and just want a clean inbox.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour-id="notifications-select-all"]',
      title: "Select notifications",
      description:
        "Tick this box to select every notification showing, or tick the box on individual rows. " +
        "Selecting them turns on the bulk action buttons.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="notifications-list"]',
      title: "The notification list",
      description:
        "Each row is one notification. The coloured bar on the left shows how urgent it is — red is critical. " +
        "Click 'Open' to jump to whatever it's about, or 'Snooze' to hide it until later.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="notifications-preferences-link"]',
      title: "Notification preferences",
      description:
        "Getting too many alerts, or not enough? This link takes you to settings where you choose what you're told about and how.",
      side: "bottom",
      align: "end",
    },
    {
      title: "That's your inbox! ✅",
      description:
        "Check it daily so nothing important slips past. Replay this guide anytime from the ? button in the bottom-right corner.",
    },
  ],
};
