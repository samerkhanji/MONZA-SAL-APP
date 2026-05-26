import type { Tour } from "./types";

export const settingsPermissionsTour: Tour = {
  id: "page-settings-permissions-v1",
  kind: "page",
  label: "Settings & permissions",
  description: "Manage your team and the rules that keep the system safe.",
  page: "/settings",
  allowedRoles: ["owner"],
  steps: [
    {
      title: "Settings & permissions",
      description:
        "This tour shows you how to manage your team and operational settings. " +
        "We'll go through invites, roles, approval limits, and the audit log. Hit 'Next' to start.",
    },
    {
      element: '[data-tour-id="settings-tabs"]',
      title: "Your settings control panel",
      description:
        "This sidebar is the home of every setting that controls the whole app — " +
        "who's on the team, what they can do, your company details, and what's been happening behind the scenes.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour="settings-employees-tab"]',
      title: "Employees",
      description:
        "The Team tab is your staff roster. Every person who can sign in to the app shows up here, " +
        "with their role and whether their account is on or off.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour="settings-add-employee"]',
      title: "Add an employee",
      description:
        "Click this when someone joins the dealership. It opens a small form where you type the new person's name, " +
        "email, and role — they get an invite to set their password and they're in.",
      side: "left",
      align: "start",
    },
    {
      element: '[data-tour="settings-capability-matrix"]',
      title: "Roles and what they can do",
      description:
        "Each person gets a role — Owner, Sales, Garage Manager, Assistant, and so on. " +
        "The role decides what they can see and do. Click any row to edit a teammate's role or fine-tune their capabilities.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour="settings-approval-thresholds"]',
      title: "Approval thresholds",
      description:
        "Money limits that decide who has to sign off. For example: 'purchases over $5,000 need the owner's approval.' " +
        "Click this link to open the thresholds page and set the numbers for your dealership.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour="settings-audit-log-tab"]',
      title: "Audit log",
      description:
        "Every sensitive action — cars added, parts moved, customer notes — is logged here with the person who did it. " +
        "Click this tab whenever you need to check who changed what.",
      side: "right",
      align: "start",
    },
    {
      title: "Filter the audit log",
      description:
        "Inside the Audit Log tab you'll find three filters at the top — by type (cars, parts, customers), by user, and by date. " +
        "Use them to narrow down the list when you're investigating something specific.",
    },
    {
      title: "Exporting the log",
      description:
        "Need a copy of the audit log for your records or an accountant? Use your browser's print or save-as-PDF on the audit page. " +
        "A dedicated Export button is on its way — for now the on-screen list is the source of truth.",
    },
    {
      title: "You're done!",
      description:
        "That's Settings & permissions. Come back here any time to invite teammates, adjust roles, or tweak approval thresholds. " +
        "Replay this tour from the '?' button whenever you need a refresher.",
    },
  ],
};
