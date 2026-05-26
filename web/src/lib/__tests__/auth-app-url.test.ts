import { describe, it, expect } from "vitest";
import {
  safeAuthNextPath,
  validatePasswordResetRedirectUrl,
  isPkceVerifierOrCrossDeviceError,
  getPasswordResetRedirectUrlFromServer,
} from "@/lib/auth-app-url";

describe("safeAuthNextPath (open-redirect defence on auth callback)", () => {
  it("returns fallback for empty / non-string", () => {
    expect(safeAuthNextPath(null)).toBe("/dashboard");
    expect(safeAuthNextPath("")).toBe("/dashboard");
    expect(safeAuthNextPath(undefined as unknown as string)).toBe("/dashboard");
  });

  it("rejects external URLs", () => {
    expect(safeAuthNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeAuthNextPath("http://localhost:3001")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    // Same class of bug as safeRedirectTo: //evil.com navigates off-domain.
    expect(safeAuthNextPath("//evil.com/x")).toBe("/dashboard");
  });

  it("rejects malformed URI encoding", () => {
    // decodeURIComponent throws on a bare "%"; the helper must catch this
    // rather than crashing the callback handler.
    expect(safeAuthNextPath("/%E0%A4%A")).toBe("/dashboard");
  });

  it("strips query and fragment, keeping only the path", () => {
    expect(safeAuthNextPath("/cars?foo=bar#baz")).toBe("/cars");
  });

  it("accepts simple internal paths", () => {
    expect(safeAuthNextPath("/dashboard")).toBe("/dashboard");
    expect(safeAuthNextPath("/sales-orders/abc-123")).toBe("/sales-orders/abc-123");
  });

  it("honours custom fallback", () => {
    expect(safeAuthNextPath(null, "/login")).toBe("/login");
  });
});

describe("validatePasswordResetRedirectUrl", () => {
  it("rejects empty / unparseable input", () => {
    expect(validatePasswordResetRedirectUrl("")).toMatch(/empty/i);
    expect(validatePasswordResetRedirectUrl("not a url")).toMatch(/full url/i);
  });

  it("rejects non-http(s) protocols", () => {
    expect(validatePasswordResetRedirectUrl("ftp://monzasal.vercel.app/reset-password")).toMatch(
      /http or https/i
    );
  });

  it("rejects http for non-local hosts", () => {
    expect(
      validatePasswordResetRedirectUrl("http://monzasal.vercel.app/reset-password")
    ).toMatch(/https/i);
  });

  it("rejects hosts not in the allow-list", () => {
    expect(
      validatePasswordResetRedirectUrl("https://attacker.com/reset-password")
    ).toMatch(/allow-list/i);
  });

  it("rejects URLs with a wrong path", () => {
    expect(
      validatePasswordResetRedirectUrl("https://monzasal.vercel.app/dashboard")
    ).toMatch(/\/reset-password/);
  });

  it("rejects URLs with a hash fragment", () => {
    expect(
      validatePasswordResetRedirectUrl(
        "https://monzasal.vercel.app/reset-password#token=abc"
      )
    ).toMatch(/#fragment/);
  });

  it("accepts the canonical production URL", () => {
    expect(
      validatePasswordResetRedirectUrl("https://monzasal.vercel.app/reset-password")
    ).toBeNull();
  });

  it("accepts http://localhost:3000/reset-password (local dev)", () => {
    expect(
      validatePasswordResetRedirectUrl("http://localhost:3000/reset-password")
    ).toBeNull();
  });

  it("accepts trailing-slash variant of the path", () => {
    // Many auth tools append a trailing slash; the helper should normalise.
    expect(
      validatePasswordResetRedirectUrl(
        "https://monzasal.vercel.app/reset-password/"
      )
    ).toBeNull();
  });
});

describe("isPkceVerifierOrCrossDeviceError", () => {
  it("detects PKCE-specific failure modes", () => {
    expect(
      isPkceVerifierOrCrossDeviceError({ message: "code verifier missing" })
    ).toBe(true);
    expect(isPkceVerifierOrCrossDeviceError({ message: "PKCE flow failed" })).toBe(
      true
    );
    expect(
      isPkceVerifierOrCrossDeviceError({ message: "opened in a different device" })
    ).toBe(true);
    expect(
      isPkceVerifierOrCrossDeviceError({ message: "storage was cleared" })
    ).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isPkceVerifierOrCrossDeviceError({ message: "Network error" })).toBe(
      false
    );
    expect(isPkceVerifierOrCrossDeviceError(null)).toBe(false);
    expect(isPkceVerifierOrCrossDeviceError(undefined)).toBe(false);
  });
});

describe("getPasswordResetRedirectUrlFromServer", () => {
  it("returns the env value when NEXT_PUBLIC_SITE_URL is set", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.example.com";
    try {
      expect(getPasswordResetRedirectUrlFromServer()).toBe(
        "https://custom.example.com/reset-password"
      );
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it("falls back to requestOrigin when env is unset", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      expect(
        getPasswordResetRedirectUrlFromServer("https://preview.vercel.app")
      ).toBe("https://preview.vercel.app/reset-password");
    } finally {
      if (prev !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prev;
    }
  });

  it("ignores invalid requestOrigin and falls back to localhost or prod default", () => {
    // NODE_ENV is read-only in @types/node, so we don't mutate it here.
    // Either localhost (dev) or the prod default URL is acceptable; the
    // contract under test is that invalid input doesn't crash.
    const prevEnv = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    try {
      const out = getPasswordResetRedirectUrlFromServer("not a url");
      expect(out).toMatch(/\/reset-password$/);
      expect(out.startsWith("http://localhost") || out.startsWith("https://")).toBe(
        true
      );
    } finally {
      if (prevEnv !== undefined) process.env.NEXT_PUBLIC_SITE_URL = prevEnv;
    }
  });
});
