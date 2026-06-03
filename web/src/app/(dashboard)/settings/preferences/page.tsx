import { redirect } from "next/navigation";

/** "Preferences" is the Settings "prefs" tab; keep the deep link working. */
export default function PreferencesRedirectPage() {
  redirect("/settings?tab=prefs");
}
