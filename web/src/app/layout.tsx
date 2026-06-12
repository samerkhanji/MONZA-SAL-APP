import type { Metadata } from "next";
import type React from "react";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
// Sonner has no toasts queued at first paint, so its JS + CSS doesn't belong
// on the LCP critical path. ThemeToasterLazy wraps it in a `next/dynamic`
// client boundary so this Server Component layout stays SSR-clean.
import { ThemeToasterLazy } from "@/components/theme-toaster-lazy";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { AbortErrorHandler } from "@/components/AbortErrorHandler";
import { DevHostBanner } from "@/components/dev-host-banner";
import { GlobalKeyboardShortcuts } from "@/components/GlobalKeyboardShortcuts";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

// Plausible analytics is gated on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` being set on
// the deploy — when unset we render nothing so no third-party request fires.
// Read at module scope so the value is inlined into the server bundle and the
// conditional below short-circuits at render time.
const PLAUSIBLE_DOMAIN = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
const PLAUSIBLE_SCRIPT_URL =
  process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL?.trim() ||
  "https://plausible.io/js/script.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Mono is used inside the dashboard (VINs, plate codes, etc.) but never on
// the login/auth pages. Skipping preload keeps the mono woff2 off the
// critical request chain for unauthenticated users; it still loads when a
// `.font-mono` element renders.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Monza S.A.L.",
  description: "Monza S.A.L. - Vehicle & Business Management",
  // Internal company tool — never index, never cache in search results.
  robots: { index: false, follow: false, nocache: true },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce, set by `src/proxy.ts` on the incoming request
  // headers. Inline <script> tags below attach `nonce={nonce}` so they are
  // executable under `script-src 'nonce-...' 'strict-dynamic'` — letting us
  // drop the previous `'unsafe-inline'` bypass.
  // `?? undefined` so React serialises the attribute as omitted (rather
  // than `nonce=""`) when this layout renders during a build-time prerender
  // that doesn't run the proxy (e.g. `next build`'s metadata pass).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F59E0B" />
        {/* Allow pinch-zoom for accessibility (visually impaired staff
            rely on it). Removed maximum-scale=1 + user-scalable=no — the
            iOS keyboard-zoom-jump those flags fought is handled by the
            16px min-font on inputs in globals.css. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Monza S.A.L." />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('monza-theme');
                var theme = saved === 'light' ? 'light' : 'dark';
                document.documentElement.classList.toggle('dark', theme === 'dark');
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <GlobalKeyboardShortcuts />
          <AbortErrorHandler />
          {children}
          <ThemeToasterLazy />
          <ServiceWorkerRegistration />
          {process.env.NODE_ENV === "development" ? <DevHostBanner /> : null}
        </ThemeProvider>
        <SpeedInsights />
        {/*
         * Plausible is a privacy-friendly, cookieless analytics script. We
         * load it via next/script with afterInteractive so it never blocks
         * the LCP, and we only render the tag when the deploy is explicitly
         * configured (NEXT_PUBLIC_PLAUSIBLE_DOMAIN). Self-hosters can point
         * at their own script via NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL.
         *
         * `nonce` propagates to the injected <script> tag so it loads even
         * with `'unsafe-inline'` removed from `script-src`.
         */}
        {PLAUSIBLE_DOMAIN ? (
          <Script
            id="plausible-analytics"
            strategy="afterInteractive"
            src={PLAUSIBLE_SCRIPT_URL}
            data-domain={PLAUSIBLE_DOMAIN}
            defer
            nonce={nonce}
          />
        ) : null}
      </body>
    </html>
  );
}
