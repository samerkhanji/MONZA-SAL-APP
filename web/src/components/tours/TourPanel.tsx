"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { MapIcon, BookOpen, Wand2 } from "lucide-react";

import { useUser } from "@/lib/contexts/UserContext";
import {
  getToursForCurrentPage,
  getRelatedWorkflowTours,
  getFullAppTour,
} from "@/lib/tours/roleVisibility";
import type { Tour, TourMode } from "@/lib/tours/tourTypes";
import { getTourStatus, type TourStatus } from "@/lib/tours/tourProgress";
import { dispatchStartTour } from "@/components/tours/TourProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// TourPanel — the contents of the "?" launcher popover.
//
//   1. Current page guide  (page tour for this route)
//   2. Related workflow guides
//   3. Whole-app map (owners only)
//
// Everything is filtered by the same role/capability rules the sidebar uses
// (via roleVisibility). Each card shows what you'll learn, time, mode toggle,
// and progress (Not started / In progress / Completed).
// ============================================================================

function TourKindIcon({ kind, className }: { kind: Tour["kind"]; className?: string }) {
  if (kind === "welcome") return <MapIcon className={className} />;
  if (kind === "page") return <BookOpen className={className} />;
  return <Wand2 className={className} />;
}

function tourSubtitle(tour: Tour): string {
  if (tour.kind === "welcome") return "About 2 minutes · Map of the whole app";
  if (tour.kind === "page") return "About 2-3 minutes · This page only";
  const mins = tour.estimatedMinutes ?? 5;
  return `About ${mins} min · Hands-on, I'll guide you`;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <li className="bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </li>
  );
}

function StatusBadge({ status }: { status: TourStatus }) {
  if (status === "completed")
    return (
      <span className="shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">
        ✓ Done
      </span>
    );
  if (status === "in-progress")
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        In progress
      </span>
    );
  return null;
}

function TourRow({
  tour,
  mode,
  status,
  onModeChange,
  onStart,
}: {
  tour: Tour;
  mode: TourMode;
  status: TourStatus;
  onModeChange: (mode: TourMode) => void;
  onStart: (mode: TourMode) => void;
}) {
  const isWelcome = tour.kind === "welcome";
  return (
    <li className="border-b last:border-b-0 px-4 py-3 hover:bg-accent/30">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <TourKindIcon kind={tour.kind} className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium">{tour.label}</p>
            <StatusBadge status={status} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{tourSubtitle(tour)}</p>
          {tour.description && (
            <p className="mt-1 text-xs text-muted-foreground/80">{tour.description}</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2">
            {!isWelcome ? (
              <div className="inline-flex items-center rounded-md border bg-background p-0.5 text-xs">
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-0.5 transition-colors",
                    mode === "manual"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => onModeChange("manual")}
                >
                  Manual
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded px-2 py-0.5 transition-colors",
                    mode === "interactive"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => onModeChange("interactive")}
                >
                  Interactive
                </button>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">
                Read-only walkthrough
              </span>
            )}
            <Button size="sm" onClick={() => onStart(mode)}>
              Start
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function TourPanel({ onStarted }: { onStarted?: () => void }) {
  const { profile, appRole, hasCapability } = useUser();
  const pathname = usePathname();
  const [modes, setModes] = useState<Record<string, TourMode>>({});

  const user = useMemo(() => ({ appRole, hasCapability }), [appRole, hasCapability]);
  const pageTours = useMemo(() => getToursForCurrentPage(pathname, user), [pathname, user]);
  const relatedTours = useMemo(() => getRelatedWorkflowTours(pathname, user), [pathname, user]);
  const fullAppTour = useMemo(() => getFullAppTour(user), [user]);

  const startTour = (tour: Tour, mode: TourMode) => {
    onStarted?.();
    window.setTimeout(() => dispatchStartTour({ tourId: tour.id, mode }), 0);
  };
  const modeFor = (tour: Tour): TourMode =>
    tour.kind === "welcome" ? "manual" : modes[tour.id] ?? "manual";

  const renderRow = (tour: Tour) => (
    <TourRow
      key={tour.id}
      tour={tour}
      mode={modeFor(tour)}
      status={getTourStatus(profile?.id ?? null, tour.id)}
      onModeChange={(m) => setModes((prev) => ({ ...prev, [tour.id]: m }))}
      onStart={(m) => startTour(tour, m)}
    />
  );

  return (
    <>
      <div className="border-b px-4 py-3">
        <p className="text-sm font-semibold">Guides for this page</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick a guide. I&apos;ll walk you through it.
        </p>
      </div>
      <ul className="max-h-[60vh] overflow-y-auto">
        <SectionHeader>This page</SectionHeader>
        {pageTours.length > 0 ? (
          pageTours.map(renderRow)
        ) : (
          <li className="px-4 py-4 text-sm text-muted-foreground">
            No guide available for this page yet.
          </li>
        )}

        {relatedTours.length > 0 && (
          <>
            <SectionHeader>Related workflows</SectionHeader>
            {relatedTours.map(renderRow)}
          </>
        )}

        {fullAppTour && (
          <>
            <SectionHeader>Whole app</SectionHeader>
            {renderRow(fullAppTour)}
          </>
        )}
      </ul>
    </>
  );
}
