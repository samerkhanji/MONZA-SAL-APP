import type { Tour } from "./types";

/**
 * Page tour: /settings/notifications (short tour).
 *
 * Notification preferences — how and when you get told about things, plus a
 * way to mute records you no longer care about.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const settingsNotificationsPageTour: Tour = {
  id: "page-settings-notifications-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through notification preferences.",
  page: "/settings/notifications",
  steps: [
    {
      title: "Notification preferences 🔔",
      description:
        "This page controls how and when the system reaches you. Set it up once so you get the alerts you need and skip the noise. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="settings-notifications-channels-panel"]',
      title: "Delivery channels",
      description:
        "Pick where alerts reach you — in-app, email, WhatsApp, desktop pop-ups, or a sound for urgent ones. " +
        "In-app is always on; the others you turn on here.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-notifications-quiet-hours-panel"]',
      title: "Quiet hours",
      description:
        "Set a start and end time when email and WhatsApp alerts pause — for example overnight. " +
        "Truly critical alerts still come through no matter what.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-notifications-digest-panel"]',
      title: "Daily digest",
      description:
        "Tick categories here to bundle them into one summary email each morning instead of buzzing you all day long.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-notifications-mutes-panel"]',
      title: "Muted entities",
      description:
        "Tired of alerts about one particular car or job? Mute it here and you'll stop hearing about it.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-notifications-mute-button"]',
      title: "Add a mute",
      description:
        "Type the record you want silenced in the box, then click 'Mute'. You can remove a mute later whenever you like.",
      side: "left",
      align: "center",
    },
  ],
};
