import { redirect } from "next/navigation";

/** company is a Settings tab, not a route. Keep the bookmark/shared link working. */
export default function CompanyRedirectPage() {
  redirect("/settings?tab=company");
}
