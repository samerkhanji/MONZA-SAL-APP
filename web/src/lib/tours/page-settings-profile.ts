import type { Tour } from "./types";

/**
 * Page tour: Settings → Profile (/settings?tab=profile).
 *
 * Every employee has a profile, so this tour is role-agnostic. The 2FA-disable
 * step is marked sensitive — the interactive runner never auto-fires it.
 */
export const settingsProfilePageTour: Tour = {
  id: "page-settings-profile-v1",
  kind: "page",
  label: "Tour: Your profile",
  description: "Password, two-factor auth, language, and re-running onboarding.",
  page: "/settings",
  steps: [
    {
      element: '[data-tour-id="settings-profile-panel"]',
      navigateTo: "/settings?tab=profile",
      title: "Your profile",
      description:
        "This is your personal account area. Everyone has one. It's where you change your password, manage two-factor authentication, set your language, and replay the onboarding tour.",
      type: "overview",
      side: "top",
      align: "start",
    },
    {
      element: '[data-tour-id="settings-profile-user-card"]',
      title: "Your details & role",
      description:
        "Your name, phone, and assigned role. Your role decides what you can see and do across the whole app — if something looks missing, it's usually a role/permission setting, not a bug.",
      type: "section",
      side: "bottom",
    },
    {
      element: '[data-tour-id="settings-change-password-button"]',
      title: "Change password",
      description:
        "Use a strong, unique password and change it here if you suspect it has been seen by anyone.",
      type: "action",
      side: "left",
    },
    {
      element: '[data-tour-id="settings-profile-2fa-status"]',
      title: "Two-Factor Authentication",
      description:
        "Your account currently has Two-Factor Authentication enabled. This means you need both your password and a 6-digit code from an authenticator app to log in. This is strongly recommended for all Owner and Assistant accounts. If your password is ever stolen, 2FA prevents unauthorized access.",
      type: "section",
      side: "bottom",
    },
    {
      element: '[data-tour-id="settings-profile-disable-2fa"]',
      title: "Disabling 2FA",
      description:
        "Never disable 2FA unless instructed to by the Owner. Turning it off removes the second layer of protection on your account.",
      type: "warning",
      isSensitive: true,
      side: "left",
    },
    {
      element: '[data-tour-id="settings-profile-language-selector"]',
      title: "Language",
      description:
        "Switch the app language between English and Arabic. Your choice is saved to your profile.",
      type: "section",
      side: "left",
    },
    {
      element: '[data-tour-id="settings-profile-onboarding-tour-button"]',
      title: "Take the onboarding tour again",
      description:
        "This button replays the original onboarding tour for your role. If you are training a new employee, have them log in and click this button — it will walk them through the main features of the app based on their assigned role.",
      type: "action",
      side: "left",
    },
    {
      title: "That's your profile",
      description:
        "Keep 2FA on, use a strong password, and remember the onboarding-replay button when training someone new. Replay this guide anytime from the ? button in the bottom-right corner.",
      type: "summary",
    },
  ],
};
