// Next.js instrumentation hook (https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
//
// Runs once per server runtime at boot. We dispatch to the right Sentry
// init module based on which runtime is starting — the Node SDK and the
// Edge SDK are not interchangeable.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward unhandled request errors to Sentry. Needed for React Server
// Component errors in Next 15+; the SDK exports a helper for this.
export const onRequestError = Sentry.captureRequestError;
