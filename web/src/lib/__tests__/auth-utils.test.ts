import { describe, it, expect, vi } from "vitest";
import {
  isSessionExpiredError,
  isConnectionError,
  safeRedirectTo,
  formatAuthApiErrorMessage,
} from "@/lib/auth-utils";

// Mock the supabase client module so handleSessionExpiredError can be
// imported without a real network client. We don't drive that code path
// (it touches window.location), but the import chain needs the symbol.
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
  }),
}));

// AuthApiError shape — Supabase JS exports isAuthApiError() which checks
// for instanceof AuthApiError. We emulate it by adding the required brand
// fields that the runtime check (__isAuthError = true) inspects.
function makeAuthApiError(msg: string, status?: number, code?: string) {
  const err = new Error(msg) as Error & {
    __isAuthError?: boolean;
    status?: number;
    code?: string;
    name: string;
  };
  err.__isAuthError = true;
  err.name = "AuthApiError";
  if (status !== undefined) err.status = status;
  if (code !== undefined) err.code = code;
  return err;
}

describe("isSessionExpiredError", () => {
  it("returns false for null / non-objects", () => {
    expect(isSessionExpiredError(null)).toBe(false);
    expect(isSessionExpiredError(undefined)).toBe(false);
    expect(isSessionExpiredError("session expired")).toBe(false);
    expect(isSessionExpiredError(42)).toBe(false);
  });

  it("returns false for plain Error (not an AuthApiError)", () => {
    // Catches a real bug: previously the helper used substring match alone,
    // which mis-classified non-auth errors that happened to contain the word
    // "expired" (e.g. installment overdue messages).
    expect(isSessionExpiredError(new Error("session expired"))).toBe(false);
  });

  it("returns true for AuthApiError matching one of the patterns", () => {
    expect(
      isSessionExpiredError(makeAuthApiError("Session expired"))
    ).toBe(true);
    expect(
      isSessionExpiredError(makeAuthApiError("Invalid refresh token"))
    ).toBe(true);
    expect(
      isSessionExpiredError(makeAuthApiError("Refresh Token Not Found"))
    ).toBe(true);
    expect(
      isSessionExpiredError(makeAuthApiError("refresh token revoked"))
    ).toBe(true);
  });

  it("is case-insensitive on the message text", () => {
    expect(
      isSessionExpiredError(makeAuthApiError("SESSION EXPIRED"))
    ).toBe(true);
  });

  it("returns false for an AuthApiError with an unrelated message", () => {
    expect(
      isSessionExpiredError(makeAuthApiError("Email not confirmed"))
    ).toBe(false);
  });
});

describe("isConnectionError", () => {
  it("returns false for null / non-objects", () => {
    expect(isConnectionError(null)).toBe(false);
    expect(isConnectionError(undefined)).toBe(false);
    expect(isConnectionError(123)).toBe(false);
  });

  it("matches known network failure patterns in message", () => {
    expect(isConnectionError(new Error("Failed to fetch"))).toBe(true);
    expect(isConnectionError(new Error("NetworkError when …"))).toBe(true);
    expect(isConnectionError(new Error("Load failed"))).toBe(true);
    expect(isConnectionError(new Error("ECONNREFUSED 127.0.0.1"))).toBe(true);
    expect(isConnectionError(new Error("request timed out"))).toBe(true);
  });

  it("matches via error.name even with unrelated message", () => {
    const e1 = Object.assign(new Error("x"), { name: "TypeError" });
    expect(isConnectionError(e1)).toBe(true);
    const e2 = Object.assign(new Error("x"), { name: "NetworkError" });
    expect(isConnectionError(e2)).toBe(true);
  });

  it("returns false for a plain validation error", () => {
    expect(isConnectionError(new Error("Phone number required"))).toBe(false);
  });
});

describe("safeRedirectTo (open-redirect defence)", () => {
  it("falls back when input is empty / non-string / null", () => {
    expect(safeRedirectTo(null)).toBe("/dashboard");
    expect(safeRedirectTo(undefined)).toBe("/dashboard");
    expect(safeRedirectTo("")).toBe("/dashboard");
    expect(safeRedirectTo(42 as unknown as string)).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs (//evil.com)", () => {
    // This is the core regression: //evil.com is a valid URL the browser
    // navigates off-domain to. Without this guard a /login?redirectTo=//evil
    // can phish a freshly authenticated user.
    expect(safeRedirectTo("//attacker.com/x")).toBe("/dashboard");
    expect(safeRedirectTo("//attacker.com/x", "/home")).toBe("/home");
  });

  it("rejects backslash-prefixed variants", () => {
    expect(safeRedirectTo("/\\evil.com")).toBe("/dashboard");
  });

  it("rejects percent-encoded slash / backslash", () => {
    expect(safeRedirectTo("/%2Fevil.com")).toBe("/dashboard");
    expect(safeRedirectTo("/%2fevil.com")).toBe("/dashboard");
    expect(safeRedirectTo("/%5Cevil.com")).toBe("/dashboard");
  });

  it("rejects URLs that don't start with /", () => {
    expect(safeRedirectTo("dashboard")).toBe("/dashboard");
    expect(safeRedirectTo("https://attacker.com")).toBe("/dashboard");
    expect(safeRedirectTo("javascript:alert(1)")).toBe("/dashboard");
  });

  it("accepts simple internal paths", () => {
    expect(safeRedirectTo("/dashboard")).toBe("/dashboard");
    expect(safeRedirectTo("/cars/123")).toBe("/cars/123");
    expect(safeRedirectTo("/sales-orders?status=draft")).toBe(
      "/sales-orders?status=draft"
    );
  });

  it("honours custom fallback", () => {
    expect(safeRedirectTo(null, "/login")).toBe("/login");
  });
});

describe("formatAuthApiErrorMessage", () => {
  it("returns a generic message for non-Error inputs", () => {
    expect(formatAuthApiErrorMessage(null)).toBe("Something went wrong.");
    expect(formatAuthApiErrorMessage(undefined)).toBe("Something went wrong.");
    expect(formatAuthApiErrorMessage("oops")).toBe("Something went wrong.");
  });

  it("passes through non-auth Error messages unchanged", () => {
    // Behaviour: when it's not an AuthApiError, return the raw message
    // without HTTP/code suffixes.
    expect(formatAuthApiErrorMessage(new Error("Random failure"))).toBe(
      "Random failure"
    );
  });

  it("translates 'over_email_send_rate_limit' code to friendly text", () => {
    const msg = formatAuthApiErrorMessage(
      makeAuthApiError("rate limited", 429, "over_email_send_rate_limit")
    );
    expect(msg.toLowerCase()).toContain("too many emails");
  });

  it("translates the recovery-email 500 path to actionable text", () => {
    const msg = formatAuthApiErrorMessage(
      makeAuthApiError("Error sending recovery email", 500, "unexpected_failure")
    );
    expect(msg.toLowerCase()).toContain("smtp");
  });

  it("translates HTTP 401 / invalid JWT to setup guidance", () => {
    const msg = formatAuthApiErrorMessage(makeAuthApiError("Invalid API key", 401));
    expect(msg.toLowerCase()).toContain("supabase api key");
  });

  it("translates redirect-disallowed messages with the URL hint", () => {
    const msg = formatAuthApiErrorMessage(
      makeAuthApiError("Redirect URL not allowed"),
      { redirectTo: "https://example.com/reset-password" }
    );
    expect(msg).toContain("https://example.com/reset-password");
  });

  it("appends HTTP status and code when neither special case matches", () => {
    const msg = formatAuthApiErrorMessage(
      makeAuthApiError("Something broke", 403, "weird_code")
    );
    expect(msg).toContain("Something broke");
    expect(msg).toContain("HTTP 403");
    expect(msg).toContain("weird_code");
  });
});
