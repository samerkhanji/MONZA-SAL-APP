import type { Tour } from "./types";

/**
 * Page tour: /settings.
 *
 * The settings control panel. It has tabs — Profile, Notifications, Team,
 * Company, Preferences, Audit Log. This tour points at the tab strip and the
 * main actions; it doesn't dive into every tab's internals.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const settingsPageTour: Tour = {
  id: "page-settings-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through the Settings page.",
  page: "/settings",
  steps: [
    {
      title: "Settings ⚙️",
      description:
        "This is your control panel. From here you manage your own account, your team, and how the whole system behaves. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="settings-tabs"]',
      title: "The settings tabs",
      description:
        "Settings is split into tabs — Profile, Notifications, Team, Company, Preferences, and Audit Log. " +
        "Click a tab to switch sections. The next steps explain what each one is for.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-profile-panel"]',
      title: "Profile tab",
      description:
        "Your own account — your name, your password, your language, and a button to replay the onboarding tour. " +
        "(If you're not on this tab right now, click 'Profile' to see it.)",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-change-password-button"]',
      title: "Change Password",
      description:
        "On the Profile tab, this button lets you set a new password. Do this every few months to keep your account safe.",
      side: "left",
      align: "center",
    },
    {
      element: '[data-tour-id="settings-team-panel"]',
      title: "Team tab",
      description:
        "Your list of employees. From here you add new staff, change someone's role, or switch an account on and off. " +
        "Click the 'Team' tab to open it.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-add-employee-button"]',
      title: "Add Employee",
      description:
        "On the Team tab, this button creates a new staff account — name, role, and login. " +
        "Use it whenever someone joins the dealership.",
      side: "left",
      align: "center",
    },
    {
      element: '[data-tour-id="settings-company-panel"]',
      title: "Company tab",
      description:
        "Your dealership's own details — name, phone, email, address, website. These show up on documents and exports. " +
        "Click the 'Company' tab to edit them.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-prefs-panel"]',
      title: "Preferences tab",
      description:
        "System-wide defaults like the currency and language new records use. Set these once so everyone starts from the same place.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-notifications-panel"]',
      title: "Notifications tab",
      description:
        "Turn on push notifications so the app can alert your phone or computer even when it's closed. " +
        "Click the 'Notifications' tab to manage this.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-audit-panel"]',
      title: "Audit Log tab",
      description:
        "A history of who did what — every car moved, part used, or note added. " +
        "Open the 'Audit Log' tab when you need to check who changed something.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-approval-thresholds-link"]',
      title: "Approval thresholds",
      description:
        "This link opens a separate page where you set the money limits that decide who has to sign off — for example 'refunds over $500 need the owner'.",
      side: "right",
      align: "start",
    },
    {
      title: "That's Settings! ✅",
      description:
        "This is your control room — only you and people you trust should be in here. Replay this tour anytime from your profile menu.",
    },
  ],
};
