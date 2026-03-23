"use client";

import { usePathname } from "next/navigation";
import { useUser } from "@/lib/contexts/UserContext";
import { canAccessPage } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function getPageKeyFromPathname(pathname: string):
  | "dashboard"
  | "assistant_dashboard"
  | "requests"
  | "cars"
  | "accessories"
  | "test_drive"
  | "installments"
  | "parts"
  | "customers"
  | "garage"
  | "garage_history"
  | "documents"
  | "settings"
  | null {
  if (pathname.startsWith("/assistant-dashboard")) return "assistant_dashboard";
  if (pathname === "/dashboard") return "dashboard";
  if (pathname.startsWith("/cars")) return "cars";
  if (pathname.startsWith("/accessories")) return "accessories";
  if (pathname.startsWith("/test-drive")) return "test_drive";
  if (pathname.startsWith("/documents")) return "documents";
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/installments")) return "installments";
  if (pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/garage/inventory")) return "parts";
  if (pathname.startsWith("/garage/history")) return "garage_history";
  if (pathname === "/garage" || pathname.startsWith("/garage/jobs")) return "garage";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

export function PageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { appRole, loading } = useUser();

  if (loading) return null;

  const pageKey = getPageKeyFromPathname(pathname);
  const hasAccess = pageKey ? canAccessPage(pageKey, appRole) : true;

  if (!hasAccess) {
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

