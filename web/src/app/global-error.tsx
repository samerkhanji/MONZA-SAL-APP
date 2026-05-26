"use client";

// Top-level error boundary for the App Router. This is the only place
// where a React-render error that escapes every route-level `error.tsx`
// (including the root layout itself crashing) will land. We forward it
// to Sentry via the dedicated helper so the underscore-prefixed Next
// internal frame is preserved, then render a minimal HTML shell so the
// user is not left staring at a blank page.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // `captureUnderscoreErrorException` is the helper Sentry recommends
    // for the boundary error path. It expects the standard Next `_error`
    // shape, so we wrap the plain Error in `{ err }`.
    void Sentry.captureUnderscoreErrorException({ err: error });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "1rem",
          margin: 0,
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong.
          </h1>
          <p style={{ fontSize: "0.875rem", opacity: 0.7, marginBottom: "1.25rem" }}>
            The app hit an unexpected error and has been reported. You can try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #fafafa",
              background: "transparent",
              color: "#fafafa",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
