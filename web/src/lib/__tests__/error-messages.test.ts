import { describe, it, expect } from "vitest";
import { formatError } from "@/lib/error-messages";

/**
 * Every public-facing toast goes through formatError. The original audit
 * (see file header) found 131 places leaking raw Postgres strings to
 * non-technical employees. These tests pin the translations so an
 * accidental edit to the switch statement is caught immediately.
 */

describe("formatError — fallbacks", () => {
  it("falsy input → generic message", () => {
    expect(formatError(null)).toMatch(/something went wrong/i);
    expect(formatError(undefined)).toMatch(/something went wrong/i);
    expect(formatError(0)).toMatch(/something went wrong/i);
  });

  it("plain string is passed through (caller already shaped it)", () => {
    expect(formatError("Custom toast text")).toBe("Custom toast text");
  });

  it("empty error object → generic message (never empty)", () => {
    expect(formatError({})).toMatch(/something went wrong/i);
  });
});

describe("formatError — Postgres SQLSTATE translations", () => {
  it("23505 unique_violation → friendly duplicate text", () => {
    expect(formatError({ code: "23505", message: "duplicate key value" })).toMatch(
      /already exists/i
    );
  });

  it("23503 foreign_key_violation → returns custom message when present", () => {
    expect(
      formatError({ code: "23503", message: "Cannot delete customer with linked sales orders" })
    ).toMatch(/cannot delete customer/i);
  });

  it("23502 not_null_violation → required-field text", () => {
    expect(formatError({ code: "23502", message: "null value in column" })).toMatch(
      /required field is missing/i
    );
  });

  it("42501 insufficient_privilege → permission text", () => {
    expect(formatError({ code: "42501", message: "permission denied for table" })).toMatch(
      /don't have permission/i
    );
  });

  it("PGRST301 / PGRST302 (JWT expired) → session expired text", () => {
    expect(formatError({ code: "PGRST301" })).toMatch(/session has expired/i);
    expect(formatError({ code: "PGRST302" })).toMatch(/session has expired/i);
  });

  it("PGRST116 (no rows) → not-found text", () => {
    expect(formatError({ code: "PGRST116" })).toMatch(/couldn't find that record/i);
  });
});

describe("formatError — substring matches on raw error messages", () => {
  it("'row-level security' → permission text (the original bug)", () => {
    // Catches the audit case directly: previously employees saw
    // "new row violates row-level security policy for table sales_orders".
    expect(
      formatError({
        message:
          "new row violates row-level security policy for table sales_orders",
      })
    ).toMatch(/don't have permission/i);
  });

  it("'duplicate key' phrasing matches", () => {
    expect(formatError({ message: "duplicate key value violates …" })).toMatch(
      /already exists/i
    );
  });

  it("'violates foreign key' phrasing matches", () => {
    expect(formatError({ message: "update violates foreign key constraint" })).toMatch(
      /conflicts with related data/i
    );
  });

  it("'failed to fetch' → connection text", () => {
    expect(formatError({ message: "TypeError: Failed to fetch" })).toMatch(
      /connection problem/i
    );
  });

  it("'JWT' / 'expired' → session text", () => {
    expect(formatError({ message: "JWT expired" })).toMatch(/session has expired/i);
  });

  it("'timeout' → friendly retry hint", () => {
    expect(formatError({ message: "Statement timeout exceeded" })).toMatch(
      /too long to respond/i
    );
  });
});

describe("formatError — pass-through prefixes (custom trigger messages)", () => {
  it('"Cannot delete customer …" is returned as-is', () => {
    const msg = "Cannot delete customer with active sales orders.";
    expect(formatError({ message: msg })).toBe(msg);
  });

  it('"forbidden" prefix is returned as-is (case-insensitive)', () => {
    expect(formatError({ message: "Forbidden: insufficient capability." })).toBe(
      "Forbidden: insufficient capability."
    );
  });

  it('"Quote must be sent" prefix is returned as-is', () => {
    expect(
      formatError({ message: "Quote must be sent before recording deposit." })
    ).toBe("Quote must be sent before recording deposit.");
  });
});
