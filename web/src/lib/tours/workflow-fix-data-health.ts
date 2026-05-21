import type { Tour } from "./types";

/**
 * Workflow tour: "Fix Data Health issues".
 *
 * Finding records with missing or wrong information and cleaning them up.
 *
 * Tone: short sentences, plain English, like explaining to a beginner.
 */
export const fixDataHealthWorkflowTour: Tour = {
  id: "workflow-fix-data-health-v1",
  kind: "workflow",
  label: "Fix Data Health issues",
  description: "Find records with missing or wrong info and clean them up.",
  estimatedMinutes: 5,
  steps: [
    {
      title: "Let's clean up the data",
      description:
        "Data Health checks your records for missing or wrong information. " +
        "Fixing those keeps the whole system trustworthy. I'll show you how. Hit 'Next' to start.",
    },
    {
      navigateTo: "/data-health",
      element: '[data-tour-id="nav-data-health"]',
      title: "Open Data Health",
      description:
        "This is the Data Health page. It scans your records and lists anything that looks off.",
      side: "right",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-summary-panel"]',
      title: "Your health score",
      description:
        "This card gives your data a score. The higher it is, the cleaner your records. " +
        "The goal is to push this number up by fixing issues.",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-severity-totals"]',
      title: "How serious the issues are",
      description:
        "These totals split issues by how serious they are. " +
        "Start with the most severe ones — those matter most.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-filter-severity"]',
      title: "Filter by severity",
      description:
        "Use this filter to show only the high-severity issues first. " +
        "That way you tackle the important ones before the small stuff.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-filter-section"]',
      title: "Filter by area",
      description:
        "This filter narrows the list to one part of the app — cars, customers, and so on. " +
        "Handy when you want to clean up one area at a time.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour-id="data-health-search-input"]',
      title: "Search for a record",
      description:
        "Looking for one specific car or customer? Type a VIN, name, or phone number here to find it.",
      side: "bottom",
      align: "start",
      waitFor: "input",
    },
    {
      title: "Open and fix each issue",
      description:
        "Each issue in the list links to the record that needs work. " +
        "Open it, add the missing detail or correct the wrong one, and save.",
    },
    {
      title: "Fix the real thing, not the symptom",
      description:
        "Avoid this mistake: don't guess a value just to clear a warning. " +
        "Wrong data is worse than missing data. Find the right answer before you save.",
    },
    {
      title: "Data Health improved!",
      description:
        "Done. Each issue you fix raises the score and makes the whole system more reliable. " +
        "Check this page now and then to keep the data clean.",
    },
  ],
};
