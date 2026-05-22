import type { Metadata } from "next";
import type React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/lib/contexts/ThemeContext";
import { ThemeToaster } from "@/components/theme-toaster";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { AbortErrorHandler } from "@/components/AbortErrorHandler";
import { DevHostBanner } from "@/components/dev-host-banner";
import { GlobalKeyboardShortcuts } from "@/components/GlobalKeyboardShortcuts";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monza S.A.L.",
  description: "Monza S.A.L. - Vehicle & Business Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={{ overscrollBehaviorX: "none" } as React.CSSProperties}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F59E0B" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Monza S.A.L." />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('monza-theme');
                var theme = saved === 'light' ? 'light' : 'dark';
                document.documentElement.classList.toggle('dark', theme === 'dark');
              })();
              (function() {
                window.addEventListener('unhandledrejection', function(e) {
                  var err = e.reason;
                  if (err && (err.name === 'AbortError' || (err.message && String(err.message).toLowerCase().indexOf('aborted') !== -1))) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }, true);
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
          <ThemeToaster />
          <ServiceWorkerRegistration />
          {process.env.NODE_ENV === "development" ? <DevHostBanner /> : null}
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
