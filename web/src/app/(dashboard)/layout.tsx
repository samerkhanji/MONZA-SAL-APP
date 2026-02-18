import { UserProvider } from "@/lib/contexts/UserContext";
import { InstallProvider } from "@/lib/contexts/InstallContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClientOnly } from "@/components/client-only";
import { PageAccessGuard } from "@/components/PageAccessGuard";
import { FloatingScanButton } from "@/components/scanner/FloatingScanButton";
import { WarrantyNotificationChecker } from "@/components/WarrantyNotificationChecker";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <ClientOnly>
        <InstallProvider>
          <DashboardShell>
            <WarrantyNotificationChecker />
            <PageAccessGuard>
              {children}
              <FloatingScanButton />
            </PageAccessGuard>
          </DashboardShell>
        </InstallProvider>
      </ClientOnly>
    </UserProvider>
  );
}
