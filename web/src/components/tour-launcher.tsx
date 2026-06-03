"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, MapIcon, BookOpen, Wand2 } from "lucide-react";

import { useUser } from "@/lib/contexts/UserContext";
import {
  getToursForCurrentPage,
  getRelatedWorkflowTours,
  getFullAppTour,
} from "@/lib/tours/tourPermissions";
import type { Tour, TourMode } from "@/lib/tours/types";
import { getTourStatus, type TourStatus } from "@/lib/tours/tourProgress";
import { dispatchStartTour, TOUR_ACTIVE_CHANGED_EVENT } from "@/components/onboarding-tour";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ============================================================================
// Floating "?" launcher — bottom-right of every dashboard page.
//
// Page-first strategy: the panel shows the CURRENT page's tour at the top,
// then workflow tours related to this page, then (owners only) the full-app
// map. Everything is filtered by the same role/capability rules the sidebar
// uses (via tourPermissions), so a tour is never offered for a page the user
// cannot open. If the current page has no tour yet, a clear message is shown.
// ============================================================================

function TourKindIcon({
  kind,
  className,
}: {
  kind: Tour["kind"];
  className?: string;
}) {
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

export function TourLauncher() {
  const { profile, appRole, hasCapability } = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  // mode toggle per tour id (defaults to "manual"). Welcome stays manual.
  const [modes, setModes] = useState<Record<string, TourMode>>({});

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean }>;
      setIsTourActive(Boolean(ce.detail?.active));
    };
    window.addEventListener(TOUR_ACTIVE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TOUR_ACTIVE_CHANGED_EVENT, handler);
  }, []);

  const user = useMemo(() => ({ appRole, hasCapability }), [appRole, hasCapability]);

  const pageTours = useMemo(
    () => getToursForCurrentPage(pathname, user),
    [pathname, user]
  );
  const relatedTours = useMemo(
    () => getRelatedWorkflowTours(pathname, user),
    [pathname, user]
  );
  const fullAppTour = useMemo(() => getFullAppTour(user), [user]);

  // Don't render until we know who the user is, or while a tour is running.
  if (!profile) return null;
  if (isTourActive) return null;

  const startTour = (tour: Tour, mode: TourMode) => {
    setOpen(false);
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="icon"
          aria-label="Tours and help"
          className={cn(
            "fixed right-4 bottom-20 z-40 size-12 rounded-full shadow-lg",
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <HelpCircle className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-80 p-0">
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
