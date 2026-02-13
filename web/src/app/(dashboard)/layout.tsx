import { UserProvider } from "@/lib/contexts/UserContext";
import { DashboardShell } from "@/components/dashboard-shell";
import { ClientOnly } from "@/components/client-only";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <ClientOnly>
        <DashboardShell>{children}</DashboardShell>
      </ClientOnly>
    </UserProvider>
  );
}
