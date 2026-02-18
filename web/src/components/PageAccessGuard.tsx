"use client";

import { usePathname } from "next/navigation";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    canSeeDashboard,
    canSeeCars,
    canSeeDocuments,
    canSeePartsInventory,
    canSeeGarageJobs,
    canSeeGarageHistory,
    isRequestAssistant,
    isOwner,
    loading,
  } = useUser();

  if (loading) return null;

  const hasAccess = (): boolean => {
    if (pathname.startsWith("/assistant-dashboard"))
      return isRequestAssistant || isOwner;
    if (pathname === "/dashboard") return canSeeDashboard;
    if (pathname.startsWith("/cars") && pathname !== "/cars") return canSeeCars;
    if (pathname === "/cars") return canSeeCars;
    if (pathname.startsWith("/documents")) return canSeeDocuments;
    if (pathname.startsWith("/customers")) return true;
    if (pathname.startsWith("/requests")) return true;
    if (pathname === "/garage" || pathname.startsWith("/garage/jobs"))
      return canSeeGarageJobs;
    if (pathname.startsWith("/garage/inventory")) return canSeePartsInventory;
    if (pathname.startsWith("/garage/history")) return true;
    if (pathname.startsWith("/settings")) return true;
    return true;
  };

  if (!hasAccess()) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground text-center">
          You do not have permission to access this page.
        </p>
        <Button asChild>
          <Link href="/requests">Go to Request Center</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
