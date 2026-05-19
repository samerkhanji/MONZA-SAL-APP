"use client";

import { usePathname } from "next/navigation";
import { useUser } from "@/lib/contexts/UserContext";
import {
  canAccessPage,
  hasCapability,
  type AppCapability,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type PageKey =
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
  | "garage_settings"
  | "dashboard_overview";

function getPageKeyFromPathname(pathname: string): PageKey | null {
  if (pathname.startsWith("/assistant-dashboard")) return "assistant_dashboard";
  if (pathname.startsWith("/dashboard/overview")) return "dashboard_overview";
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
  if (
    pathname === "/garage" ||
    pathname.startsWith("/garage/jobs") ||
    pathname.startsWith("/garage/tasks")
  )
    return "garage";
  if (pathname.startsWith("/garage/settings")) return "garage_settings";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

/**
 * Capability fallback for pages that should also be reachable via a
 * specific capability when the user's role alone doesn't grant access.
 * Keeps the role-based PAGE_PERMISSIONS contract (and tests) intact while
 * letting capability-flagged users (e.g. a hybrid with "cashier") in.
 */
const PAGE_CAPABILITY_FALLBACK: Partial<Record<PageKey, AppCapability>> = {
  installments: "cashier",
};

export function PageAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { appRole, profile, loading } = useUser();

  if (loading) return null;

  const pageKey = getPageKeyFromPathname(pathname);
  const roleAccess = pageKey ? canAccessPage(pageKey, appRole) : true;
  const capFallback =
    pageKey && PAGE_CAPABILITY_FALLBACK[pageKey]
      ? hasCapability(profile, PAGE_CAPABILITY_FALLBACK[pageKey] as AppCapability)
      : false;
  const hasAccess = roleAccess || capFallback;

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

