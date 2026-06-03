import type { AppRole, AppCapability } from "@/lib/permissions";
import { ROLES_WITH_DATA_HEALTH_ACCESS } from "@/lib/data-health-config";

/**
 * Single source of truth for "can this user see / reach a navigation
 * destination". Both the sidebar (DashboardShell) and the tour launcher consult
 * this, so a tour is never offered for a page the user's navigation hides.
 *
 * The per-href rules below are a verbatim extraction of the sidebar's inline
 * filter — change them here and both stay in sync.
 */
export interface NavAccessUser {
  appRole: AppRole | null;
  hasCapability: (cap: AppCapability) => boolean;
}

function inRoles(role: AppRole, roles: AppRole[]): boolean {
  return roles.includes(role);
}

/** Access rule for a top-level or garage-child nav href. */
export function canAccessNavHref(href: string, user: NavAccessUser): boolean {
  const { appRole, hasCapability } = user;
  if (!appRole) return false;

  switch (href) {
    case "/assistant-dashboard":
      return inRoles(appRole, ["assistant", "owner", "hybrid", "khalil_hybrid"]);
    case "/dashboard":
    case "/dashboard/overview":
    case "/settings":
      return appRole === "owner";
    case "/data-health":
      return ROLES_WITH_DATA_HEALTH_ACCESS.includes(appRole);
    case "/reports":
      return (
        appRole === "owner" ||
        hasCapability("view_reports") ||
        hasCapability("manage_team")
      );
    case "/requests":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "it",
        "garage_manager", "garage_staff", "sales_ops", "sales",
      ]);
    case "/cars":
    case "/recall-center":
    case "/ordered-cars":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "it", "sales_ops", "sales",
      ]);
    case "/customers":
    case "/installments":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "sales_ops", "sales",
      ]);
    case "/company-costs":
      return (
        appRole === "owner" ||
        hasCapability("view_reports") ||
        hasCapability("cashier") ||
        hasCapability("garage") ||
        hasCapability("manage_team")
      );
    case "/sales-orders":
      return inRoles(appRole, ["owner", "assistant", "sales_ops", "sales"]);
    case "/trade-ins":
      return (
        appRole === "owner" ||
        hasCapability("sales") ||
        hasCapability("garage") ||
        hasCapability("manage_team") ||
        hasCapability("view_reports")
      );
    case "/documents":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "it",
        "garage_manager", "sales_ops", "sales",
      ]);
    case "/garage":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "garage_manager", "garage_staff",
      ]);
    case "/garage/inventory":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "it", "garage_manager", "garage_staff",
      ]);
    case "/garage/history":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "garage_manager", "sales_ops", "sales",
      ]);
    case "/garage/efficiency":
      return inRoles(appRole, ["owner", "assistant", "garage_manager", "hybrid", "khalil_hybrid"]);
    case "/garage/tasks":
      return inRoles(appRole, [
        "owner", "assistant", "hybrid", "khalil_hybrid", "garage_manager", "garage_staff",
      ]);
    case "/garage/suppliers":
    case "/garage/purchase-orders":
      return (
        appRole === "owner" ||
        hasCapability("inventory") ||
        hasCapability("cashier") ||
        hasCapability("manage_team")
      );
    case "/garage/warranty":
    case "/garage/recalls":
      return (
        appRole === "owner" ||
        hasCapability("garage") ||
        hasCapability("view_reports") ||
        hasCapability("manage_team")
      );
    case "/garage/refunds":
      return (
        appRole === "owner" ||
        hasCapability("garage") ||
        hasCapability("cashier") ||
        hasCapability("manage_team") ||
        hasCapability("view_reports")
      );
    case "/garage/settings":
      return (
        appRole === "owner" ||
        appRole === "garage_manager" ||
        appRole === "hybrid" ||
        appRole === "khalil_hybrid"
      );
    default:
      // Pages with no special gate (e.g. /cash, /accessories, /test-drive,
      // /notifications) — visible to any signed-in user, mirroring the sidebar's
      // `return true` default.
      return true;
  }
}

/**
 * Maps a runtime pathname (including detail / nested routes) to the nav href
 * that gates it, then checks access. Used by the tour system so a page tour is
 * hidden whenever the user couldn't open that page.
 *
 * Order matters: more specific garage children are tested before `/garage`.
 */
const PATH_TO_NAV_HREF: Array<[RegExp, string]> = [
  [/^\/garage\/inventory(\/|$)/, "/garage/inventory"],
  [/^\/ordered-parts(\/|$)/, "/garage/inventory"],
  [/^\/garage\/purchase-orders(\/|$)/, "/garage/purchase-orders"],
  [/^\/garage\/suppliers(\/|$)/, "/garage/suppliers"],
  [/^\/garage\/warranty(\/|$)/, "/garage/warranty"],
  [/^\/garage\/recalls(\/|$)/, "/garage/recalls"],
  [/^\/garage\/refunds(\/|$)/, "/garage/refunds"],
  [/^\/garage\/history(\/|$)/, "/garage/history"],
  [/^\/garage\/efficiency(\/|$)/, "/garage/efficiency"],
  [/^\/garage\/time-reports(\/|$)/, "/garage/efficiency"],
  [/^\/garage\/tasks(\/|$)/, "/garage/tasks"],
  [/^\/garage\/settings(\/|$)/, "/garage/settings"],
  [/^\/garage(\/|$)/, "/garage"], // jobs list + /garage/jobs/[id]
  [/^\/cars(\/|$)/, "/cars"],
  [/^\/recall-center(\/|$)/, "/recall-center"],
  [/^\/ordered-cars(\/|$)/, "/ordered-cars"],
  [/^\/customers(\/|$)/, "/customers"],
  [/^\/sales-orders(\/|$)/, "/sales-orders"],
  [/^\/trade-ins(\/|$)/, "/trade-ins"],
  [/^\/installments(\/|$)/, "/installments"],
  [/^\/test-drive(\/|$)/, "/test-drive"],
  [/^\/accessories(\/|$)/, "/accessories"],
  [/^\/documents(\/|$)/, "/documents"],
  [/^\/company-costs(\/|$)/, "/company-costs"],
  [/^\/data-health(\/|$)/, "/data-health"],
  [/^\/reports(\/|$)/, "/reports"],
  [/^\/requests(\/|$)/, "/requests"],
  [/^\/assistant-dashboard(\/|$)/, "/assistant-dashboard"],
  [/^\/dashboard\/overview(\/|$)/, "/dashboard/overview"],
  [/^\/dashboard(\/|$)/, "/dashboard"],
  [/^\/settings(\/|$)/, "/settings"],
];

export function canAccessPath(path: string, user: NavAccessUser): boolean {
  for (const [re, href] of PATH_TO_NAV_HREF) {
    if (re.test(path)) return canAccessNavHref(href, user);
  }
  // Unknown / always-available paths (/cash, /notifications, etc.).
  return true;
}
