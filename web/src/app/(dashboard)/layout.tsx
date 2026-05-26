import { redirect } from "next/navigation";
import { UserProvider } from "@/lib/contexts/UserContext";
import { InstallProvider } from "@/lib/contexts/InstallContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageAccessGuard } from "@/components/PageAccessGuard";
import { FloatingScanButton } from "@/components/scanner/FloatingScanButton";
// WarrantyNotificationChecker was removed — warranty expiry alerts are
// produced server-side via the `detect_warranty_expiry` pg_cron job
// (supabase/migrations/092_test_drive_and_warranty_crons.sql).
import { SessionEnforcer } from "@/components/auth/SessionEnforcer";
import { FirstLoginGuard } from "@/components/auth/FirstLoginGuard";
import { ProfileActivityHeartbeat } from "@/components/ProfileActivityHeartbeat";
import { LogRocketInit } from "@/components/LogRocketInit";
import { IOSInstallTooltip } from "@/components/pwa/IOSInstallTooltip";
import { OutboxSyncInit } from "@/components/OutboxSyncInit";
import { getSessionUserAndRole } from "@/lib/server/session-app-role";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication gate for the whole dashboard route group —
  // no dashboard HTML is rendered for an unauthenticated request. Per-page
  // role authorization remains in PageAccessGuard (client).
  const session = await getSessionUserAndRole();
  if (!session) redirect("/login");

  return (
    <UserProvider>
      <LogRocketInit />
      <OutboxSyncInit />
      <SessionEnforcer>
        <InstallProvider>
          <DashboardShell>
            <ProfileActivityHeartbeat />
            <FirstLoginGuard>
              <PageAccessGuard>
                {children}
                <FloatingScanButton />
              </PageAccessGuard>
            </FirstLoginGuard>
          </DashboardShell>
          <IOSInstallTooltip />
        </InstallProvider>
      </SessionEnforcer>
    </UserProvider>
  );
}
