import type { AppRole } from "@/lib/permissions";
import type { Tour } from "./types";
import { ownerWelcomeTour } from "./tour-owner";

// Workflow tours — cross-page interactive journeys.
import { addCarWorkflowTour } from "./workflow-add-car";
import { sellCarWorkflowTour } from "./workflow-sell-car";
import { addCustomerWorkflowTour } from "./workflow-add-customer";
import { testDriveWorkflowTour } from "./workflow-test-drive";
import { cashSessionWorkflowTour } from "./workflow-cash-session";
import { recordPaymentWorkflowTour } from "./workflow-record-payment";
import { createJobWorkflowTour } from "./workflow-create-job";
import { receivePartsWorkflowTour } from "./workflow-receive-parts";
import { processRefundWorkflowTour } from "./workflow-process-refund";
import { warrantyCaseWorkflowTour } from "./workflow-warranty-case";
import { updateJobStatusWorkflowTour } from "./workflow-update-job-status";
import { assignWorkWorkflowTour } from "./workflow-assign-work";
import { addPartsToJobWorkflowTour } from "./workflow-add-parts-to-job";
import { createPurchaseOrderWorkflowTour } from "./workflow-create-purchase-order";
import { manageLowStockWorkflowTour } from "./workflow-manage-low-stock";
import { manageTradeInWorkflowTour } from "./workflow-manage-trade-in";
import { submitRequestWorkflowTour } from "./workflow-submit-request";
import { reviewRequestsWorkflowTour } from "./workflow-review-requests";
import { checkReportsWorkflowTour } from "./workflow-check-reports";
import { fixDataHealthWorkflowTour } from "./workflow-fix-data-health";
import { uploadDocumentsWorkflowTour } from "./workflow-upload-documents";
import { handleRecallWorkflowTour } from "./workflow-handle-recall";

// Page tours — sales side
import { carsPageTour } from "./page-cars";
import { carsAddPageTour } from "./page-cars-add";
import { carsDetailPageTour } from "./page-cars-detail";
import { customersPageTour } from "./page-customers";
import { customersAddPageTour } from "./page-customers-add";
import { customersDetailPageTour } from "./page-customers-detail";
import { salesOrdersPageTour } from "./page-sales-orders";
import { salesOrderDetailPageTour } from "./page-sales-order-detail";
import { installmentsPageTour } from "./page-installments";
import { testDrivePageTour } from "./page-test-drive";
import { tradeInsPageTour } from "./page-trade-ins";
import { tradeInDetailPageTour } from "./page-trade-in-detail";
import { accessoriesPageTour } from "./page-accessories";
import { documentsPageTour } from "./page-documents";

// Page tours — garage
import { garagePageTour } from "./page-garage";
import { garageTasksPageTour } from "./page-garage-tasks";
import { garageInventoryPageTour } from "./page-garage-inventory";
import { garagePurchaseOrdersPageTour } from "./page-garage-purchase-orders";
import { garagePurchaseOrderDetailPageTour } from "./page-garage-purchase-order-detail";
import { garageSuppliersPageTour } from "./page-garage-suppliers";
import { garageWarrantyPageTour } from "./page-garage-warranty";
import { garageWarrantyDetailPageTour } from "./page-garage-warranty-detail";
import { garageRecallsPageTour } from "./page-garage-recalls";
import { garageRecallDetailPageTour } from "./page-garage-recall-detail";
import { garageRefundsPageTour } from "./page-garage-refunds";
import { garageRefundDetailPageTour } from "./page-garage-refund-detail";
import { garageHistoryPageTour } from "./page-garage-history";
import { garageEfficiencyPageTour } from "./page-garage-efficiency";
import { garageTimeReportsPageTour } from "./page-garage-time-reports";
import { garageSettingsPageTour } from "./page-garage-settings";
import { garageJobDetailPageTour } from "./page-garage-job-detail";

// Page tours — admin / dashboard
import { dashboardPageTour } from "./page-dashboard";
import { overviewPageTour } from "./page-overview";
import { assistantDashboardPageTour } from "./page-assistant-dashboard";
import { dataHealthPageTour } from "./page-data-health";
import { notificationsPageTour } from "./page-notifications";
import { reportsPageTour } from "./page-reports";
import { requestsPageTour } from "./page-requests";
import { requestsPendingPageTour } from "./page-requests-pending";
import { settingsPageTour } from "./page-settings";
import { settingsApprovalThresholdsPageTour } from "./page-settings-approval-thresholds";
import { settingsNotificationsPageTour } from "./page-settings-notifications";
import { settingsWorkflowRulesPageTour } from "./page-settings-workflow-rules";
import { companyCostsPageTour } from "./page-company-costs";

// ============================================================================
// Welcome tours — one per role. Auto-fired on first login. Manual mode only.
//
// Phase A: owner.
// Phase B: sales, garage_manager, garage_staff.
// Phase C: assistant, hybrid, khalil_hybrid, it, sales_ops.
// ============================================================================
const WELCOME_TOURS: Partial<Record<AppRole, Tour>> = {
  owner: ownerWelcomeTour,
};

// ============================================================================
// Page tours — keyed by path. Offered by the launcher when the current
// pathname matches. Keys may contain Next.js dynamic segments (e.g. "[id]");
// `pageKeyMatches` resolves them against the real runtime pathname.
// ============================================================================
const PAGE_TOURS: Record<string, Tour[]> = {
  // Sales side
  "/cars": [carsPageTour],
  "/cars/add": [carsAddPageTour],
  "/cars/[id]": [carsDetailPageTour],
  "/customers": [customersPageTour],
  "/customers/add": [customersAddPageTour],
  "/customers/[id]": [customersDetailPageTour],
  "/sales-orders": [salesOrdersPageTour],
  "/sales-orders/[id]": [salesOrderDetailPageTour],
  "/installments": [installmentsPageTour],
  "/test-drive": [testDrivePageTour],
  "/trade-ins": [tradeInsPageTour],
  "/trade-ins/[id]": [tradeInDetailPageTour],
  "/accessories": [accessoriesPageTour],
  "/documents": [documentsPageTour],
  // Garage
  "/garage": [garagePageTour],
  "/garage/tasks": [garageTasksPageTour],
  "/garage/inventory": [garageInventoryPageTour],
  "/garage/purchase-orders": [garagePurchaseOrdersPageTour],
  "/garage/purchase-orders/[id]": [garagePurchaseOrderDetailPageTour],
  "/garage/suppliers": [garageSuppliersPageTour],
  "/garage/warranty": [garageWarrantyPageTour],
  "/garage/warranty/[id]": [garageWarrantyDetailPageTour],
  "/garage/recalls": [garageRecallsPageTour],
  "/garage/recalls/[id]": [garageRecallDetailPageTour],
  "/garage/refunds": [garageRefundsPageTour],
  "/garage/refunds/[id]": [garageRefundDetailPageTour],
  "/garage/history": [garageHistoryPageTour],
  "/garage/efficiency": [garageEfficiencyPageTour],
  "/garage/time-reports": [garageTimeReportsPageTour],
  "/garage/settings": [garageSettingsPageTour],
  "/garage/jobs/[id]": [garageJobDetailPageTour],
  // Admin / dashboard
  "/dashboard": [dashboardPageTour],
  "/dashboard/overview": [overviewPageTour],
  "/assistant-dashboard": [assistantDashboardPageTour],
  "/data-health": [dataHealthPageTour],
  "/notifications": [notificationsPageTour],
  "/reports": [reportsPageTour],
  "/requests": [requestsPageTour],
  "/requests/pending": [requestsPendingPageTour],
  "/settings": [settingsPageTour],
  "/settings/approval-thresholds": [settingsApprovalThresholdsPageTour],
  "/settings/notifications": [settingsNotificationsPageTour],
  "/settings/workflow-rules": [settingsWorkflowRulesPageTour],
  "/company-costs": [companyCostsPageTour],
};

// ============================================================================
// Workflow tours — cross-page interactive journeys. Surfaced everywhere.
// ============================================================================
const WORKFLOW_TOURS: Tour[] = [
  addCarWorkflowTour,
  sellCarWorkflowTour,
  addCustomerWorkflowTour,
  testDriveWorkflowTour,
  cashSessionWorkflowTour,
  recordPaymentWorkflowTour,
  createJobWorkflowTour,
  receivePartsWorkflowTour,
  processRefundWorkflowTour,
  warrantyCaseWorkflowTour,
  updateJobStatusWorkflowTour,
  assignWorkWorkflowTour,
  addPartsToJobWorkflowTour,
  createPurchaseOrderWorkflowTour,
  manageLowStockWorkflowTour,
  manageTradeInWorkflowTour,
  submitRequestWorkflowTour,
  reviewRequestsWorkflowTour,
  checkReportsWorkflowTour,
  fixDataHealthWorkflowTour,
  uploadDocumentsWorkflowTour,
  handleRecallWorkflowTour,
];

// ============================================================================
// Lookup helpers.
// ============================================================================

function isAllowedForRole(tour: Tour, role: AppRole | null | undefined): boolean {
  if (!tour.allowedRoles || tour.allowedRoles.length === 0) return true;
  if (!role) return false;
  return tour.allowedRoles.includes(role);
}

/**
 * True if a registered page-tour key matches a runtime pathname. Keys may
 * contain Next.js dynamic segments written as `[param]` — those match any
 * single path segment. Literal segments must match exactly. The path and the
 * key must have the same number of segments (so `/cars` does NOT match
 * `/cars/add` — each has its own tour).
 */
function pageKeyMatches(key: string, path: string): boolean {
  const keyParts = key.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (keyParts.length !== pathParts.length) return false;
  return keyParts.every((kp, i) => {
    if (kp.startsWith("[") && kp.endsWith("]")) return true;
    return kp === pathParts[i];
  });
}

/** Count of literal (non-dynamic) segments — used to prefer the most specific key. */
function literalSegmentCount(key: string): number {
  return key
    .split("/")
    .filter(Boolean)
    .filter((s) => !(s.startsWith("[") && s.endsWith("]"))).length;
}

/**
 * Returns the welcome tour for the given role, or null if none is shipped yet.
 * Used by the auto-fire on first login.
 */
export function getWelcomeTourForRole(role: AppRole | null | undefined): Tour | null {
  if (!role) return null;
  const tour = WELCOME_TOURS[role];
  return tour ?? null;
}

/**
 * Back-compat alias for the legacy "one tour per role" API. New code should
 * use `getWelcomeTourForRole`.
 */
export function getTourForRole(role: AppRole | null | undefined): Tour | null {
  return getWelcomeTourForRole(role);
}

/**
 * Returns all page tours that match the given pathname AND are allowed for
 * the given role. When several keys match (e.g. `/cars/add` matches both
 * `/cars/add` and `/cars/[id]`), the most specific key wins — the one with
 * the most literal segments.
 */
export function getPageTours(
  path: string,
  role: AppRole | null | undefined
): Tour[] {
  const matches = Object.keys(PAGE_TOURS).filter((k) => pageKeyMatches(k, path));
  if (matches.length === 0) return [];
  // Most-specific key wins.
  matches.sort((a, b) => literalSegmentCount(b) - literalSegmentCount(a));
  const best = matches[0];
  return PAGE_TOURS[best].filter((t) => isAllowedForRole(t, role));
}

/**
 * Returns all workflow tours allowed for the given role.
 */
export function getWorkflowTours(role: AppRole | null | undefined): Tour[] {
  return WORKFLOW_TOURS.filter((t) => isAllowedForRole(t, role));
}

/**
 * Returns every tour the launcher should surface on the current page for the
 * given role: welcome (if any) first, then page tours, then workflow tours.
 */
export function getAllAvailableTours(
  path: string,
  role: AppRole | null | undefined
): Tour[] {
  const out: Tour[] = [];
  const welcome = getWelcomeTourForRole(role);
  if (welcome) out.push(welcome);
  out.push(...getPageTours(path, role));
  out.push(...getWorkflowTours(role));
  return out;
}

/**
 * Looks up a tour by id across all three buckets. Used by the
 * `monza:start-tour` event handler to resolve the requested tour.
 */
export function getTourById(id: string): Tour | null {
  for (const t of Object.values(WELCOME_TOURS)) {
    if (t && t.id === id) return t;
  }
  for (const list of Object.values(PAGE_TOURS)) {
    for (const t of list) {
      if (t.id === id) return t;
    }
  }
  for (const t of WORKFLOW_TOURS) {
    if (t.id === id) return t;
  }
  return null;
}
