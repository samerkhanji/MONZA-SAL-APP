"use server";

/**
 * Server Actions for the 7 money-mover RPCs.
 *
 * Launch security Decision 2 (audit): direct EXECUTE on these RPCs has been
 * REVOKED from the `authenticated` role (migration 168). The browser can no
 * longer reach them via supabase.rpc(). All 7 are mediated by Server Actions
 * defined in this module.
 *
 * Server-side flow for each action:
 *   1. Verify a session exists via the cookie-bound supabase client (the
 *      user's JWT is the authority for who is calling).
 *   2. Call the SECURITY DEFINER wrapper RPC `_srv_*` via the service-role
 *      admin client. Wrappers accept `p_acting_user_id` as the first
 *      parameter, set `request.jwt.claims` locally so the underlying RPC's
 *      `auth.uid()` returns the verified user, and then invoke the original
 *      RPC. The original RPCs are unchanged.
 *   3. Return `{ ok: true, data? }` or `{ ok: false, error }`. Raw Postgres
 *      error strings are funneled through `formatError()` so the UI sees a
 *      user-friendly message.
 *
 * Wrapper RPCs grant EXECUTE only to `service_role`, never `authenticated`.
 * Combined with the REVOKE on the originals, this means: the only path to
 * a money-mover RPC is through these Server Actions.
 */

import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { formatError } from "@/lib/error-messages";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Resolve the calling user id from the cookie-bound supabase client.
 * Returns null if no valid session is present.
 */
async function getActingUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user.id;
}

/**
 * Invoke a wrapper RPC via the service-role admin client. The wrapper itself
 * sets `request.jwt.claims` so the original RPC's `auth.uid()` works.
 */
async function callWrapper<T = unknown>(
  wrapperName: string,
  args: Record<string, unknown>
): Promise<ActionResult<T>> {
  const userId = await getActingUserId();
  if (!userId) return { ok: false, error: "unauthenticated" };

  const admin = tryCreateAdminClient();
  if (!admin) {
    return {
      ok: false,
      error:
        "Server is missing required Supabase credentials. Contact an administrator.",
    };
  }

  // Untyped on purpose — the wrappers are private DB helpers not in the
  // generated client types.
  const adminAny = admin as unknown as {
    rpc: (
      fn: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>;
  };

  const { data, error } = await adminAny.rpc(wrapperName, {
    p_acting_user_id: userId,
    ...args,
  });

  if (error) {
    return { ok: false, error: formatError(error) };
  }
  return { ok: true, data: data as T };
}

// ---------------------------------------------------------------------------
// 1. record_manual_cash_movement
// ---------------------------------------------------------------------------

export interface RecordManualCashMovementInput {
  p_kind: string;
  p_direction: "in" | "out";
  p_amount: number;
  p_note?: string;
  p_drawer_id?: string;
}

export async function recordManualCashMovement(
  input: RecordManualCashMovementInput
): Promise<ActionResult<string>> {
  return callWrapper<string>("_srv_record_manual_cash_movement", {
    p_kind: input.p_kind,
    p_direction: input.p_direction,
    p_amount: input.p_amount,
    p_note: input.p_note ?? null,
    p_drawer_id: input.p_drawer_id ?? null,
  });
}

// ---------------------------------------------------------------------------
// 2. submit_purchase_order
// ---------------------------------------------------------------------------

export async function submitPurchaseOrder(
  poId: string
): Promise<ActionResult<{ status?: string }>> {
  return callWrapper<{ status?: string }>("_srv_submit_purchase_order", {
    p_po_id: poId,
  });
}

// ---------------------------------------------------------------------------
// 3. approve_refund
// ---------------------------------------------------------------------------

export async function approveRefund(
  refundId: string
): Promise<ActionResult<void>> {
  return callWrapper<void>("_srv_approve_refund", {
    p_refund_id: refundId,
  });
}

// ---------------------------------------------------------------------------
// 4. reject_refund
// ---------------------------------------------------------------------------

export async function rejectRefund(
  refundId: string,
  reason: string
): Promise<ActionResult<void>> {
  return callWrapper<void>("_srv_reject_refund", {
    p_refund_id: refundId,
    p_reason: reason,
  });
}

// ---------------------------------------------------------------------------
// 5. void_sales_order
// ---------------------------------------------------------------------------

export async function voidSalesOrder(
  salesOrderId: string,
  reason: string
): Promise<ActionResult<void>> {
  return callWrapper<void>("_srv_void_sales_order", {
    p_sales_order_id: salesOrderId,
    p_reason: reason,
  });
}

// ---------------------------------------------------------------------------
// 6. gdpr_anonymize_customer
// ---------------------------------------------------------------------------

export async function gdprAnonymizeCustomer(
  customerId: string,
  reason: string
): Promise<ActionResult<void>> {
  return callWrapper<void>("_srv_gdpr_anonymize_customer", {
    p_customer_id: customerId,
    p_reason: reason,
  });
}

// ---------------------------------------------------------------------------
// 7. apply_installment_payment
// ---------------------------------------------------------------------------

export interface ApplyInstallmentPaymentInput {
  p_installment_id: string;
  p_amount: number;
  p_payment_method: string;
  p_receipt_url?: string;
  p_note?: string;
}

export interface ApplyInstallmentPaymentResult {
  new_status?: string;
  overage_to_credits?: number;
  shortfall?: number;
}

export async function applyInstallmentPayment(
  input: ApplyInstallmentPaymentInput
): Promise<ActionResult<ApplyInstallmentPaymentResult>> {
  return callWrapper<ApplyInstallmentPaymentResult>(
    "_srv_apply_installment_payment",
    {
      p_installment_id: input.p_installment_id,
      p_amount: input.p_amount,
      p_payment_method: input.p_payment_method,
      p_receipt_url: input.p_receipt_url ?? null,
      p_note: input.p_note ?? null,
    }
  );
}
