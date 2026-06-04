import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant content-area placeholder shown during sidebar navigation.
 *
 * Next.js renders this as the Suspense fallback while the target route's code
 * and data load, so clicking a sidebar link swaps the content area to a
 * skeleton immediately instead of leaving the previous page frozen for ~1–2s.
 * The persistent shell (sidebar, top bar) stays mounted around it.
 *
 * It's intentionally generic — a header, a row of stat tiles and a table —
 * which reads as "loading" across every dashboard page without trying to
 * mirror each one exactly.
 */
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      {/* Page header (title + subtitle) */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Stat / KPI tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border-border space-y-3 rounded-lg border p-5"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>

      {/* Main content block (table / list) */}
      <div className="bg-card border-border space-y-4 rounded-lg border p-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
