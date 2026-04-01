"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Dashboard error boundary caught an error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong in the dashboard.
          </h1>
          <p className="text-sm text-muted-foreground">
            The dashboard hit an unexpected error. You can try again, or go back to the main dashboard.
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
            onClick={() => router.push("/dashboard")}
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

