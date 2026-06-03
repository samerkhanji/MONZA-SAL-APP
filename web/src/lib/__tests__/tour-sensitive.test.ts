import { describe, it, expect } from "vitest";
import { isSensitiveSelector, isSensitiveText } from "@/lib/tours/sensitive";

/**
 * Locks the audit fix: the heuristic must flag sensitive ACTION controls but
 * not benign elements that merely live in a module named "refund".
 */
describe("isSensitiveSelector", () => {
  it("flags real final-action controls", () => {
    for (const s of [
      "refund-detail-approve",
      "refund-detail-pay",
      "sales-order-detail-void-button",
      "cars-detail-scrap-button",
      "cars-list-row-actions-scrap",
      "customers-detail-delete-button",
      "installments-due-row-mark-paid",
      "installments-mark-paid-confirm",
      "settings-user-deactivate",
    ]) {
      expect(isSensitiveSelector(s), s).toBe(true);
    }
  });

  it("does NOT flag benign elements on a sensitive-named page", () => {
    for (const s of [
      "refund-detail-back",
      "refund-detail-summary",
      "refund-detail-actions",
      "refunds-status-tabs",
      "refunds-search",
      "refunds-table",
      "refunds-request",
      "refunds-request-dialog",
      "nav-refunds",
      "payment-history-card", // "payment" must not match the "pay" token
      "company-costs-panel",
    ]) {
      expect(isSensitiveSelector(s), s).toBe(false);
    }
  });

  it("handles null/empty", () => {
    expect(isSensitiveSelector(null)).toBe(false);
    expect(isSensitiveSelector("")).toBe(false);
  });
});

describe("isSensitiveText", () => {
  it("flags action button text", () => {
    expect(isSensitiveText("Approve")).toBe(true);
    expect(isSensitiveText("Void sale")).toBe(true);
    expect(isSensitiveText("Mark as paid")).toBe(true);
  });
  it("ignores plain labels", () => {
    expect(isSensitiveText("Refunds")).toBe(false);
    expect(isSensitiveText("Back")).toBe(false);
    expect(isSensitiveText("Search")).toBe(false);
  });
});
