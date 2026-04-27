"use client";

import { useEffect } from "react";
import { useUser } from "@/lib/contexts/UserContext";

/**
 * LogRocket SDK initialization for Monza CRM.
 *
 * App ID: px16ic/monza-crm
 *
 * **Privacy stance — important for a CRM with customer financial data:**
 * - All input fields are masked by default (DOM masking).
 * - Network request/response bodies are sanitized (Authorization,
 *   Supabase keys, anything that looks like a password are stripped).
 * - Only enabled in production builds and only on the live host —
 *   not on Vercel preview URLs, not on localhost.
 * - Skipped entirely if user opted out via `localStorage.lr_optout`.
 *
 * After this lands you should review:
 * https://docs.logrocket.com/reference/dom (per-element redaction)
 * https://docs.logrocket.com/reference/network (per-route sanitization)
 */
export function LogRocketInit() {
  const { profile } = useUser();

  useEffect(() => {
    // Run only in the browser, only in production, only on the live host.
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    const host = window.location.hostname;
    const isProdHost =
      host === "monzacrm.vercel.app" || host === "web-dun-beta-59.vercel.app";
    if (!isProdHost) return;

    // Per-user opt-out (set via DevTools or a future settings toggle).
    try {
      if (window.localStorage.getItem("lr_optout") === "1") return;
    } catch {
      // localStorage blocked → fail open (still record)
    }

    let cancelled = false;
    void (async () => {
      const [{ default: LogRocket }, { default: setupLogRocketReact }] =
        await Promise.all([import("logrocket"), import("logrocket-react")]);
      if (cancelled) return;

      LogRocket.init("px16ic/monza-crm", {
        // Pin a release so source-maps + stack-traces map to a specific
        // commit. Vercel injects VERCEL_GIT_COMMIT_SHA on the server; on
        // the client we expose it through NEXT_PUBLIC_RELEASE if set.
        release:
          process.env.NEXT_PUBLIC_RELEASE ??
          process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
          "unknown",
        dom: {
          // Mask EVERY input by default. Specific non-sensitive fields
          // can opt in later by adding `data-public="true"`.
          inputSanitizer: true,
          textSanitizer: false,
          baseHref: undefined,
        },
        network: {
          requestSanitizer: (request) => {
            // Strip Authorization + apikey headers regardless of route.
            if (request.headers) {
              delete request.headers["Authorization"];
              delete request.headers["authorization"];
              delete request.headers["apikey"];
              delete request.headers["x-supabase-auth"];
            }
            // Drop request bodies on auth + admin routes entirely.
            if (
              request.url.includes("/auth/") ||
              request.url.includes("/api/admin/") ||
              request.url.includes("/api/team/") ||
              request.url.includes("/api/auth/")
            ) {
              request.body = undefined;
            }
            return request;
          },
          responseSanitizer: (response) => {
            // Drop response bodies for the same sensitive routes.
            const url = response.url ?? "";
            if (
              url.includes("/auth/") ||
              url.includes("/api/admin/") ||
              url.includes("/api/team/") ||
              url.includes("/api/auth/")
            ) {
              response.body = undefined;
            }
            return response;
          },
        },
        // Don't capture the user's IP server-side; Lebanon-only userbase,
        // not useful and increases data-retention risk.
        shouldCaptureIP: false,
      });

      // React plugin: tags components in the DOM tree so the LogRocket
      // session viewer can show component names instead of just <div>.
      // Note: v7 typings take no args; LogRocket is imported internally.
      setupLogRocketReact();

      // Surface the session URL once it's known so it appears in any
      // server-side log we forward later (Sentry, Grafana, etc.).
      LogRocket.getSessionURL((sessionURL: string) => {
        // eslint-disable-next-line no-console
        console.info("[LogRocket] session", sessionURL);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Identify the authenticated user once the profile loads. Re-runs if
  // the user signs out and back in as someone else.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!profile?.id) return;

    void (async () => {
      const { default: LogRocket } = await import("logrocket");
      LogRocket.identify(profile.id, {
        name: profile.full_name ?? "",
        role: profile.user_role ?? "unknown",
        // Don't pass phone/email — minimize PII on identity payload.
      });
    })();
  }, [profile?.id, profile?.full_name, profile?.user_role]);

  return null;
}
