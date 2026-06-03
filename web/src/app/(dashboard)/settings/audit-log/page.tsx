import { redirect } from "next/navigation";

/**
 * Audit Log is a tab inside the Settings page, not a standalone route. This
 * redirect keeps /settings/audit-log working as a bookmark / shared link
 * instead of 404ing — it lands on the Settings page with the Audit Log tab
 * pre-selected (permission is enforced there).
 */
export default function AuditLogRedirectPage() {
  redirect("/settings?tab=audit-log");
}
