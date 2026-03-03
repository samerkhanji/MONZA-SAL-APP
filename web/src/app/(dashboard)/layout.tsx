import { UserProvider } from "@/lib/contexts/UserContext";
import { InstallProvider } from "@/lib/contexts/InstallContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClientOnly } from "@/components/client-only";
import { PageAccessGuard } from "@/components/PageAccessGuard";
import { FloatingScanButton } from "@/components/scanner/FloatingScanButton";
import { WarrantyNotificationChecker } from "@/components/WarrantyNotificationChecker";
import { SessionEnforcer } from "@/components/auth/SessionEnforcer";
import { FirstLoginGuard } from "@/components/auth/FirstLoginGuard";
import { OnboardingTour } from "@/components/OnboardingTour";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <ClientOnly>
        <SessionEnforcer>
          <InstallProvider>
            <DashboardShell>
              <WarrantyNotificationChecker />
              <FirstLoginGuard>
                <PageAccessGuard>
                  {children}
                  <FloatingScanButton />
                </PageAccessGuard>
                <OnboardingTour />
              </FirstLoginGuard>
            </DashboardShell>
          </InstallProvider>
        </SessionEnforcer>
      </ClientOnly>
    </UserProvider>
  );
}
