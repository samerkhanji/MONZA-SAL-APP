import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16+: the `middleware` file convention is deprecated in favor of `proxy`.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
// Paths that must be reachable without auth (PWA shell, manifest, SW).
// Belt + suspenders: also listed in `config.matcher` below, but matcher
// regex behavior is fragile, so short-circuit here too.
const PUBLIC_FILES = new Set([
  "/offline.html",
  "/manifest.json",
  "/sw.js",
  "/favicon.ico",
]);

/**
 * Derive the Plausible script origin from the override URL (self-hosted) or
 * fall back to plausible.io cloud. Mirrors the logic that used to live in
 * `next.config.ts` so the CSP allowlist matches whichever deploy this is.
 */
function plausibleOrigin(): string {
  const override = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim();
  if (!override) return "https://plausible.io";
  try {
    return new URL(override).origin;
  } catch {
    return "https://plausible.io";
  }
}

/**
 * Pull the Supabase project origin from `NEXT_PUBLIC_SUPABASE_URL` so the CSP
 * connect-src allowlist matches whichever project this deploy points at.
 * Falls back to a wildcard supabase.co host so previews without the env var
 * set still work (no-op CSP rather than blocking the whole app).
 */
function supabaseOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return "https://*.supabase.co";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

/**
 * Build the Content-Security-Policy with a per-request nonce in `script-src`.
 *
 * Why per-request nonce instead of `'unsafe-inline'`:
 * - `'unsafe-inline'` defeats the main XSS protection CSP provides — any
 *   injected `<script>` runs. A fresh nonce per response makes the inline
 *   bootstrap in `layout.tsx` (theme init + AbortError swallow) executable
 *   without the bypass.
 * - `'strict-dynamic'` lets scripts loaded by a nonced script (the Next.js
 *   framework loader) load further scripts without re-listing every origin,
 *   so we can keep the third-party allowlist small. Modern browsers honor
 *   the nonce + 'strict-dynamic' combo and ignore the host allowlist /
 *   'unsafe-inline' fallbacks below; pre-CSP3 browsers do the opposite, so
 *   listing both keeps third-party scripts working everywhere.
 *
 * Notes:
 * - style-src keeps 'unsafe-inline' — shadcn/Radix/Tailwind inject runtime
 *   inline styles and there is no production-safe hash story for them.
 * - connect-src covers Sentry envelope, Plausible, Supabase (HTTPS + WSS),
 *   LogRocket, Vercel Speed Insights.
 */
function buildContentSecurityPolicy(nonce: string): string {
  const plausible = plausibleOrigin();
  const supabase = supabaseOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Needed to instantiate the Tesseract.js OCR WASM core (VIN photo scan).
      "'wasm-unsafe-eval'",
      // Host allowlist for browsers that don't understand 'strict-dynamic'.
      // CSP3-compliant browsers ignore these in favor of the nonce.
      plausible,
      "https://cdn.lr-ingest.com",
      "https://cdn.logrocket.io",
      "https://cdn.lr-in.com",
      "https://va.vercel-scripts.com",
      // Pre-CSP2 fallback: also ignored by browsers that honor the nonce.
      "'unsafe-inline'",
      "https:",
    ],
    // The OCR VIN scanner (Tesseract.js) runs in a Web Worker created from a
    // same-origin / blob URL; its self-hosted core lives under /tesseract/.
    "worker-src": ["'self'", "blob:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase, "https:"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
    "connect-src": [
      "'self'",
      "blob:",
      // Tesseract.js OCR language data (eng.traineddata) — data fetch only.
      "https://cdn.jsdelivr.net",
      plausible,
      supabase,
      supabase.replace(/^https:/, "wss:"),
      "https://*.ingest.sentry.io",
      "https://*.ingest.us.sentry.io",
      "https://*.ingest.de.sentry.io",
      "https://*.lr-ingest.com",
      "https://*.lr-in.com",
      "https://*.logrocket.io",
      "https://vitals.vercel-insights.com",
      "https://vitals.vercel-analytics.com",
    ],
    "frame-ancestors": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Generate a fresh 128-bit nonce, base64-encoded. WebCrypto + base64 are
 * available in the Edge runtime where this proxy runs; we avoid `Buffer` so
 * the implementation doesn't depend on a Node polyfill.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export async function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;

  // Static assets and Next.js internals don't need a CSP nonce — they're
  // not HTML and the browser doesn't enforce script-src on them. Returning
  // early avoids spending a WebCrypto call on every chunk request.
  if (p.startsWith("/_next/") || p === "/_next") {
    return NextResponse.next();
  }
  if (PUBLIC_FILES.has(p)) {
    return NextResponse.next();
  }

  const nonce = generateNonce();
  const csp = buildContentSecurityPolicy(nonce);

  // Make the nonce visible to React Server Components via `headers()` so
  // inline <script> blocks in `layout.tsx` can attach `nonce={nonce}`.
  // Setting it on the *request* headers (which `updateSession` forwards
  // verbatim to its `NextResponse.next({ request: { headers } })`) is the
  // mechanism Next.js documents for nonce propagation.
  request.headers.set("x-nonce", nonce);
  // Next.js also looks for the CSP on the incoming request headers when
  // deciding whether to attach the nonce to its own framework scripts.
  request.headers.set("Content-Security-Policy", csp);

  // Hand off to the existing Supabase auth flow. It may return a redirect
  // (unauthenticated user hitting a protected route) or a pass-through
  // response; either way we wrap the resulting response with the CSP
  // header below so the browser actually enforces it.
  const sessionResponse = await updateSession(request);

  sessionResponse.headers.set("Content-Security-Policy", csp);
  // Optional but useful for debugging: surface the nonce in the response
  // too. The browser ignores `x-nonce`; this is only for grep-from-curl
  // verification.
  sessionResponse.headers.set("x-nonce", nonce);

  return sessionResponse;
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|manifest.json|sw.js|offline.html|icons/|images/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|otf)$).*)",
  ],
};
