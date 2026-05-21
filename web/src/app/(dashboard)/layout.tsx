import { UserProvider } from "@/lib/contexts/UserContext";
import { InstallProvider } from "@/lib/contexts/InstallContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClientOnly } from "@/components/client-only";
import { PageAccessGuard } from "@/components/PageAccessGuard";
import { FloatingScanButton } from "@/components/scanner/FloatingScanButton";
import { WarrantyNotificationChecker } from "@/components/WarrantyNotificationChecker";
import { SessionEnforcer } from "@/components/auth/SessionEnforcer";
import { FirstLoginGuard } from "@/components/auth/FirstLoginGuard";
import { ProfileActivityHeartbeat } from "@/components/ProfileActivityHeartbeat";
import { LogRocketInit } from "@/components/LogRocketInit";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <ClientOnly>
        <LogRocketInit />
        <SessionEnforcer>
          <InstallProvider>
            <DashboardShell>
              <ProfileActivityHeartbeat />
              <WarrantyNotificationChecker />
              <FirstLoginGuard>
                <PageAccessGuard>
                  {children}
                  <FloatingScanButton />
                </PageAccessGuard>
              </FirstLoginGuard>
            </DashboardShell>
          </InstallProvider>
        </SessionEnforcer>
      </ClientOnly>
    </UserProvider>
  );
}
