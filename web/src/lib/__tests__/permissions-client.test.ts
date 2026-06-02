import { describe, it, expect } from "vitest";
import type { UserProfile } from "@/lib/contexts/UserContext";
import {
  canApproveRefund,
  canRejectRefund,
  canVoidSalesOrder,
  canAnonymizeCustomer,
  canRecordManualCashMovement,
  canSubmitPurchaseOrder,
  canApplyInstallmentPayment,
} from "@/lib/permissions-client";

/** Minimal profile fixture builder — tests only read user_role + capabilities. */
function profile(
  user_role: UserProfile["user_role"],
  capabilities: UserProfile["capabilities"] = []
): UserProfile {
  return {
    id: "u1",
    full_name: "Test User",
    phone: null,
    user_role,
    capabilities,
    is_active: true,
  };
}

describe("permissions-client", () => {
  describe("null profile", () => {
    // The seven helpers fan out across role/capability rules, but they share
    // one invariant: a missing profile (unauthenticated / still loading) MUST
    // hide the button. Hard-asserting that here keeps a future refactor from
    // accidentally turning hidden-while-loading into briefly-flashed-visible.
    it.each([
      ["canApproveRefund", canApproveRefund],
      ["canRejectRefund", canRejectRefund],
      ["canVoidSalesOrder", canVoidSalesOrder],
      ["canAnonymizeCustomer", canAnonymizeCustomer],
      ["canRecordManualCashMovement", canRecordManualCashMovement],
      ["canSubmitPurchaseOrder", canSubmitPurchaseOrder],
      ["canApplyInstallmentPayment", canApplyInstallmentPayment],
    ])("%s denies when profile is null", (_name, fn) => {
      expect(fn(null)).toBe(false);
    });
  });

  describe("owner-only actions", () => {
    const ownerOnly = [
      ["canApproveRefund", canApproveRefund],
      ["canRejectRefund", canRejectRefund],
      ["canVoidSalesOrder", canVoidSalesOrder],
      ["canAnonymizeCustomer", canAnonymizeCustomer],
      ["canApplyInstallmentPayment", canApplyInstallmentPayment],
    ] as const;

    it.each(ownerOnly)("%s allows owner", (_name, fn) => {
      expect(fn(profile("owner"))).toBe(true);
    });

    it.each(ownerOnly)(
      "%s denies non-owner roles even with every capability",
      (_name, fn) => {
        // Non-owner with the full known capability set still cannot use these.
        // Catches a regression where a helper mistakenly fell through to a
        // capability check (e.g. copy-pasted from canRecordManualCashMovement).
        const decked = profile("sales_ops", [
          "garage",
          "vehicle_software",
          "cashier",
          "events_ops",
          "manage_team",
          "edit_users",
          "deactivate_users",
          "view_reports",
          "inventory",
          "sales",
          "data_health",
          "view_customer_documents",
        ]);
        expect(fn(decked)).toBe(false);
      }
    );

    it.each([
      "assistant",
      "hybrid",
      "khalil_hybrid",
      "it",
      "garage_manager",
      "garage_staff",
      "sales_ops",
      "sales",
    ] as const)("canVoidSalesOrder denies %s", (role) => {
      expect(canVoidSalesOrder(profile(role))).toBe(false);
    });
  });

  describe("canRecordManualCashMovement (owner OR cashier)", () => {
    it("allows owner", () => {
      expect(canRecordManualCashMovement(profile("owner"))).toBe(true);
    });

    it("allows non-owner with cashier capability", () => {
      expect(
        canRecordManualCashMovement(profile("sales_ops", ["cashier"]))
      ).toBe(true);
    });

    it("denies non-owner without cashier capability", () => {
      expect(canRecordManualCashMovement(profile("sales_ops"))).toBe(false);
    });

    it("denies non-owner whose only capability is inventory", () => {
      // Targeted check that the helper doesn't accidentally accept inventory
      // (the capability for canSubmitPurchaseOrder).
      expect(
        canRecordManualCashMovement(profile("sales_ops", ["inventory"]))
      ).toBe(false);
    });
  });

  describe("canSubmitPurchaseOrder (owner OR inventory)", () => {
    it("allows owner", () => {
      expect(canSubmitPurchaseOrder(profile("owner"))).toBe(true);
    });

    it("allows non-owner with inventory capability", () => {
      expect(
        canSubmitPurchaseOrder(profile("garage_manager", ["inventory"]))
      ).toBe(true);
    });

    it("denies non-owner without inventory capability", () => {
      expect(canSubmitPurchaseOrder(profile("garage_manager"))).toBe(false);
    });

    it("denies non-owner whose only capability is cashier", () => {
      // Targeted: the cashier capability must not satisfy submit-PO.
      expect(
        canSubmitPurchaseOrder(profile("sales_ops", ["cashier"]))
      ).toBe(false);
    });
  });
});
