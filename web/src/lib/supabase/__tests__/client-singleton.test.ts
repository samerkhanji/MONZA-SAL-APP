import { describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Regression test for adversarial review PR #135: the browser-side
 * `createClient()` MUST return the same instance on every call so that
 * realtime channels, `useCallback` identities, and HTTP connection reuse
 * all work correctly. Creating a fresh client per render was the root
 * cause of multiple bugs flagged in the review.
 */
describe("supabase browser client singleton", () => {
  const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ORIGINAL_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ORIGINAL_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  afterEach(async () => {
    const mod = await import("../client");
    mod.__resetBrowserClientForTests();
    if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
    if (ORIGINAL_ANON === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON;
    if (ORIGINAL_PUB === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_PUB;
  });

  it("returns the exact same client instance on repeated calls", async () => {
    const { createClient, __resetBrowserClientForTests } = await import(
      "../client"
    );
    __resetBrowserClientForTests();

    const a = createClient();
    const b = createClient();
    const c = createClient();

    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("returns the same instance when imported via the @/lib/supabase re-export", async () => {
    const direct = await import("../client");
    direct.__resetBrowserClientForTests();

    const reExport = await import("@/lib/supabase");

    const fromDirect = direct.createClient();
    const fromReExport = reExport.createClient();

    expect(fromDirect).toBe(fromReExport);
  });

  it("still returns a usable client after the test-only reset helper", async () => {
    // Note: @supabase/ssr also keeps its own browser-side singleton, so
    // resetting our cache does not necessarily produce a brand-new instance.
    // We assert correctness (we still get a client back, and subsequent
    // calls share identity) rather than non-identity across resets.
    const { createClient, __resetBrowserClientForTests } = await import(
      "../client"
    );
    __resetBrowserClientForTests();

    const first = createClient();
    __resetBrowserClientForTests();
    const second = createClient();

    expect(second).toBeDefined();
    // After the reset, the new instance is still cached for further calls.
    expect(second).toBe(createClient());
    // And `first` is also a valid client object.
    expect(first).toBeDefined();
  });

  it("throws a clear error when Supabase env vars are missing", async () => {
    const { createClient, __resetBrowserClientForTests } = await import(
      "../client"
    );
    __resetBrowserClientForTests();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(() => createClient()).toThrowError(/Missing Supabase config/);
  });
});
