/**
 * Client-side capability checks for the 7 money-mover actions whose backend
 * is gated by SECURITY DEFINER RPCs / Server Actions + REVOKE EXECUTE.
 *
 * Centralizing the role/capability rules in one helper keeps these in sync
 * across all the call sites that show/hide the corresponding buttons, so the
 * UI stops offering actions that will land on "insufficient privileges"
 * errors at the backend. The backend remains the source of truth — these
 * helpers only decide whether to render the button.
 *
 * Owners short-circuit to true via {@link hasCapability} (mirrors the DB
 * helper), so we don't have to spell that out per-rule below.
 */
import type { UserProfile } from "@/lib/contexts/UserContext";
import { hasCapability } from "@/lib/permissions";

function isOwner(user: UserProfile | null): boolean {
  return user?.user_role === "owner";
}

/** Approve a refund. Owner only. */
export function canApproveRefund(user: UserProfile | null): boolean {
  return isOwner(user);
}

/** Reject a refund. Owner only. */
export function canRejectRefund(user: UserProfile | null): boolean {
  return isOwner(user);
}

/** Void a sales order. Owner only. */
export function canVoidSalesOrder(user: UserProfile | null): boolean {
  return isOwner(user);
}

/** GDPR-anonymize a customer. Owner only. */
export function canAnonymizeCustomer(user: UserProfile | null): boolean {
  return isOwner(user);
}

/**
 * Record a manual cash movement on the open cash session.
 * Owner OR cashier capability.
 */
export function canRecordManualCashMovement(user: UserProfile | null): boolean {
  return hasCapability(user, "cashier");
}

/**
 * Submit a draft purchase order for approval.
 * Owner OR inventory capability.
 */
export function canSubmitPurchaseOrder(user: UserProfile | null): boolean {
  return hasCapability(user, "inventory");
}

/**
 * Apply a payment to an installment.
 * Owner only — matches the SECURITY DEFINER RPC's owner-only enforcement
 * after PR #157. (The legacy capability-gated path is now closed.)
 */
export function canApplyInstallmentPayment(user: UserProfile | null): boolean {
  return isOwner(user);
}
