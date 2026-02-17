import { UserProvider } from "@/lib/contexts/UserContext";
import { InstallProvider } from "@/lib/contexts/InstallContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClientOnly } from "@/components/client-only";
import { FloatingScanButton } from "@/components/scanner/FloatingScanButton";

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
            {children}
            <FloatingScanButton />
          </DashboardShell>
        </InstallProvider>
      </ClientOnly>
    </UserProvider>
  );
}
