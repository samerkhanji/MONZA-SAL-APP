import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Regression test for adversarial review #135 — `NEXT_PUBLIC_DEBUG_PASSWORD_RESET`
 * is a *public* env var (bundled into the client) and was previously honored
 * server-side, letting anyone who controls the build flip on logs that include
 * the redacted email + GoTrue response body. Production must read a
 * server-only flag instead.
 *
 * The flag function is intentionally not exported, so we exercise the behavior
 * by importing the route module fresh and asserting on the captured
 * console.info calls during a POST.
 */
describe("request-password-reset debug env guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  async function callRouteWithEnv(env: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/auth/request-password-reset", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://monzasal.vercel.app" },
      body: JSON.stringify({ email: "alice@example.com" }),
    });
    // @ts-expect-error — NextRequest is structurally compatible enough for the route.
    await POST(req);
    const debugLogged = info.mock.calls.some(
      ([tag]) => typeof tag === "string" && tag.startsWith("[PasswordResetDebug server]")
    );
    info.mockRestore();
    return { debugLogged };
  }

  it("ignores NEXT_PUBLIC_DEBUG_PASSWORD_RESET in production", async () => {
    const { debugLogged } = await callRouteWithEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_DEBUG_PASSWORD_RESET: "1",
      DEBUG_PASSWORD_RESET: undefined,
    });
    expect(debugLogged).toBe(false);
  });

  it("honors the server-only DEBUG_PASSWORD_RESET in production", async () => {
    const { debugLogged } = await callRouteWithEnv({
      NODE_ENV: "production",
      DEBUG_PASSWORD_RESET: "1",
      NEXT_PUBLIC_DEBUG_PASSWORD_RESET: undefined,
    });
    expect(debugLogged).toBe(true);
  });

  it("still logs in development without any flag set", async () => {
    const { debugLogged } = await callRouteWithEnv({
      NODE_ENV: "development",
      DEBUG_PASSWORD_RESET: undefined,
      NEXT_PUBLIC_DEBUG_PASSWORD_RESET: undefined,
    });
    expect(debugLogged).toBe(true);
  });
});
