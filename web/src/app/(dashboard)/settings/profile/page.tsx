import { redirect } from "next/navigation";

/** profile is a Settings tab, not a route. Keep the bookmark/shared link working. */
export default function ProfileRedirectPage() {
  redirect("/settings?tab=profile");
}
