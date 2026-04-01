"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Root error boundary caught an error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
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
              onClick={() => router.push("/")}
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
      </body>
    </html>
  );
}

