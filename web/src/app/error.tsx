"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Route-level error boundary. Renders INSIDE the root layout, which already
 * provides <html>/<body>. Only `app/global-error.tsx` may render its own
 * <html>/<body>; wrapping again here produced nested DOM + hydration warnings.
 *
 * The "Go to dashboard" button uses a hard navigation because Next's router
 * context may be torn after an error inside the root layout.
 */
export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Root error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong.
          </h1>
          <p className="text-sm text-muted-foreground">
            The app hit an unexpected error. You can try again, or go back to the dashboard.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            type="button"
            onClick={() => reset()}
            className="sm:min-w-[140px]"
          >
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/dashboard";
              }
            }}
            className="sm:min-w-[140px]"
          >
            Go to dashboard
          </Button>
        </div>
        {error?.digest ? (
          <p className="text-[10px] text-muted-foreground/70">
            Error id: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}

