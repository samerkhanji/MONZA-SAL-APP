import type { Tour } from "./types";

/**
 * Page tour: /settings/approval-thresholds (short tour).
 *
 * "Approval thresholds" are dollar limits that decide who has to sign off on
 * something. Below the manager floor it auto-approves; at or above the owner
 * floor it goes to the owner.
 *
 * Tone: short sentences, plain English, like explaining to a smart 12-year-old.
 * Selectors reference `data-tour-id` attributes — see SELECTORS.md.
 */
export const settingsApprovalThresholdsPageTour: Tour = {
  id: "page-settings-approval-thresholds-v1",
  kind: "page",
  label: "Tour: This page",
  description: "Walk through approval thresholds.",
  page: "/settings/approval-thresholds",
  steps: [
    {
      title: "Approval thresholds 💵",
      description:
        "An approval threshold is a money limit that decides who needs to sign off. " +
        "Small amounts go through on their own; big amounts come to you. This page is where you set those limits. Hit 'Next'.",
    },
    {
      element: '[data-tour-id="settings-approval-thresholds-intro"]',
      title: "How it works",
      description:
        "Two limits per rule. Below the manager floor, it approves itself. At or above the manager floor, a manager must sign off. " +
        "At or above the owner floor, it comes all the way to you.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-approval-threshold-card"]',
      title: "A threshold rule",
      description:
        "Each card is one type of action — for example refunds or discounts. " +
        "The name and currency are shown at the top so you know exactly what you're setting.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-approval-threshold-manager-input"]',
      title: "Manager floor",
      description:
        "At or above this amount, a manager has to approve it. Type the number here. Anything under this amount goes through automatically.",
      side: "right",
      align: "center",
    },
    {
      element: '[data-tour-id="settings-approval-threshold-owner-input"]',
      title: "Owner floor",
      description:
        "At or above this amount, the owner must approve it personally. " +
        "It has to be the same as or higher than the manager floor.",
      side: "left",
      align: "center",
    },
    {
      element: '[data-tour-id="settings-approval-threshold-save"]',
      title: "Save",
      description:
        "Click Save once you've set the two limits. The new rule takes effect straight away on the next action of that type.",
      side: "top",
      align: "end",
    },
  ],
};
