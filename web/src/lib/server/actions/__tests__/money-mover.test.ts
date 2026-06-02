/**
 * Tests for the money-mover Server Actions.
 *
 * These verify the Server Action contract:
 *   - Reject when no session is present (returns `{ ok: false, error: 'unauthenticated' }`)
 *   - Reject when admin client is unavailable (returns a safe error)
 *   - Forward verified user id + RPC params to the wrapper `_srv_*` function
 *   - Translate Postgres errors via formatError() — never leak raw error strings
 *
 * Migration 168 created database-level wrappers + REVOKE EXECUTE FROM
 * authenticated. The Server Actions in this file are now the *only* entry
 * point to the 7 money-mover RPCs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be defined before the import-under-test.
const mockGetUser = vi.fn();
const mockAdminRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  tryCreateAdminClient: vi.fn(() => ({
    rpc: mockAdminRpc,
  })),
}));

import * as moneyMover from "../money-mover";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

const VALID_USER_ID = "00000000-0000-0000-0000-000000000001";
const REFUND_ID = "11111111-1111-1111-1111-111111111111";
const PO_ID = "22222222-2222-2222-2222-222222222222";
const SO_ID = "33333333-3333-3333-3333-333333333333";
const CUSTOMER_ID = "44444444-4444-4444-4444-444444444444";
const INSTALLMENT_ID = "55555555-5555-5555-5555-555555555555";

beforeEach(() => {
  mockGetUser.mockReset();
  mockAdminRpc.mockReset();
  vi.mocked(tryCreateAdminClient).mockReturnValue({
    rpc: mockAdminRpc,
  } as unknown as ReturnType<typeof tryCreateAdminClient>);
});

function authenticatedSession() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: VALID_USER_ID } },
    error: null,
  });
}

function unauthenticatedSession() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

describe("money-mover server actions", () => {
  describe("unauthenticated rejection", () => {
    it.each([
      [
        "recordManualCashMovement",
        () =>
          moneyMover.recordManualCashMovement({
            p_kind: "expense",
            p_direction: "out",
            p_amount: 100,
          }),
      ],
      [
        "submitPurchaseOrder",
        () => moneyMover.submitPurchaseOrder(PO_ID),
      ],
      [
        "approveRefund",
        () => moneyMover.approveRefund(REFUND_ID),
      ],
      [
        "rejectRefund",
        () => moneyMover.rejectRefund(REFUND_ID, "bad"),
      ],
      [
        "voidSalesOrder",
        () => moneyMover.voidSalesOrder(SO_ID, "duplicate"),
      ],
      [
        "gdprAnonymizeCustomer",
        () =>
          moneyMover.gdprAnonymizeCustomer(CUSTOMER_ID, "GDPR ticket 123"),
      ],
      [
        "applyInstallmentPayment",
        () =>
          moneyMover.applyInstallmentPayment({
            p_installment_id: INSTALLMENT_ID,
            p_amount: 250,
            p_payment_method: "cash",
          }),
      ],
    ])("%s returns unauthenticated when no session", async (_name, call) => {
      unauthenticatedSession();
      const result = await call();
      expect(result).toEqual({ ok: false, error: "unauthenticated" });
      expect(mockAdminRpc).not.toHaveBeenCalled();
    });
  });

  describe("admin client missing", () => {
    it("returns a safe error if tryCreateAdminClient returns null", async () => {
      authenticatedSession();
      vi.mocked(tryCreateAdminClient).mockReturnValueOnce(null);
      const result = await moneyMover.approveRefund(REFUND_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/Supabase credentials/i);
      }
      expect(mockAdminRpc).not.toHaveBeenCalled();
    });
  });

  describe("wrapper invocation", () => {
    it("recordManualCashMovement forwards verified user id and trims optional fields", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({
        data: "movement-id-xyz",
        error: null,
      });
      const result = await moneyMover.recordManualCashMovement({
        p_kind: "expense",
        p_direction: "out",
        p_amount: 12.5,
        p_note: "petty cash",
      });
      expect(result).toEqual({ ok: true, data: "movement-id-xyz" });
      expect(mockAdminRpc).toHaveBeenCalledWith(
        "_srv_record_manual_cash_movement",
        {
          p_acting_user_id: VALID_USER_ID,
          p_kind: "expense",
          p_direction: "out",
          p_amount: 12.5,
          p_note: "petty cash",
          p_drawer_id: null,
        }
      );
    });

    it("submitPurchaseOrder forwards po id and verified user id", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({
        data: { status: "approved" },
        error: null,
      });
      const result = await moneyMover.submitPurchaseOrder(PO_ID);
      expect(result).toEqual({ ok: true, data: { status: "approved" } });
      expect(mockAdminRpc).toHaveBeenCalledWith(
        "_srv_submit_purchase_order",
        {
          p_acting_user_id: VALID_USER_ID,
          p_po_id: PO_ID,
        }
      );
    });

    it("approveRefund forwards refund id and verified user id", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({ data: null, error: null });
      const result = await moneyMover.approveRefund(REFUND_ID);
      expect(result.ok).toBe(true);
      expect(mockAdminRpc).toHaveBeenCalledWith("_srv_approve_refund", {
        p_acting_user_id: VALID_USER_ID,
        p_refund_id: REFUND_ID,
      });
    });

    it("rejectRefund forwards reason verbatim", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({ data: null, error: null });
      await moneyMover.rejectRefund(REFUND_ID, "duplicate request");
      expect(mockAdminRpc).toHaveBeenCalledWith("_srv_reject_refund", {
        p_acting_user_id: VALID_USER_ID,
        p_refund_id: REFUND_ID,
        p_reason: "duplicate request",
      });
    });

    it("voidSalesOrder forwards reason and sale id", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({ data: null, error: null });
      await moneyMover.voidSalesOrder(SO_ID, "customer canceled");
      expect(mockAdminRpc).toHaveBeenCalledWith("_srv_void_sales_order", {
        p_acting_user_id: VALID_USER_ID,
        p_sales_order_id: SO_ID,
        p_reason: "customer canceled",
      });
    });

    it("gdprAnonymizeCustomer forwards customer id and reason", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({ data: null, error: null });
      await moneyMover.gdprAnonymizeCustomer(CUSTOMER_ID, "GDPR ticket LB-42");
      expect(mockAdminRpc).toHaveBeenCalledWith(
        "_srv_gdpr_anonymize_customer",
        {
          p_acting_user_id: VALID_USER_ID,
          p_customer_id: CUSTOMER_ID,
          p_reason: "GDPR ticket LB-42",
        }
      );
    });

    it("applyInstallmentPayment forwards all params and returns the data shape", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({
        data: {
          new_status: "paid",
          overage_to_credits: 0,
          shortfall: 0,
        },
        error: null,
      });
      const result = await moneyMover.applyInstallmentPayment({
        p_installment_id: INSTALLMENT_ID,
        p_amount: 1000,
        p_payment_method: "cash",
        p_receipt_url: "https://example.com/r",
        p_note: "first payment",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data?.new_status).toBe("paid");
      }
      expect(mockAdminRpc).toHaveBeenCalledWith(
        "_srv_apply_installment_payment",
        {
          p_acting_user_id: VALID_USER_ID,
          p_installment_id: INSTALLMENT_ID,
          p_amount: 1000,
          p_payment_method: "cash",
          p_receipt_url: "https://example.com/r",
          p_note: "first payment",
        }
      );
    });
  });

  describe("error sanitisation", () => {
    it("translates a row-level-security postgres error to a friendly message", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({
        data: null,
        error: {
          code: "42501",
          message:
            "new row violates row-level security policy for table refunds",
        },
      });
      const result = await moneyMover.approveRefund(REFUND_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // formatError() maps 42501 → "You don't have permission..."
        expect(result.error).toMatch(/permission|owner|admin/i);
        // Raw postgres internals must NOT leak.
        expect(result.error).not.toMatch(/row.level security/i);
      }
    });

    it("translates a unique_violation to a user-facing message", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value violates unique constraint \"refunds_pkey\"" },
      });
      const result = await moneyMover.approveRefund(REFUND_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/already exists/i);
      }
    });

    it("passes through custom human-readable RPC errors", async () => {
      authenticatedSession();
      mockAdminRpc.mockResolvedValue({
        data: null,
        error: {
          message:
            "Owner cannot self-approve their own refund request — get another owner or wait for manager-tier",
        },
      });
      const result = await moneyMover.approveRefund(REFUND_ID);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/self-approve/i);
      }
    });
  });
});
