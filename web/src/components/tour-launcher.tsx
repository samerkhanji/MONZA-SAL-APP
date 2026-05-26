"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, MapIcon, BookOpen, Wand2 } from "lucide-react";

import { useUser } from "@/lib/contexts/UserContext";
import { getAllAvailableTours } from "@/lib/tours/registry";
import type { Tour, TourMode } from "@/lib/tours/types";
import { dispatchStartTour, TOUR_ACTIVE_CHANGED_EVENT } from "@/components/onboarding-tour";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ============================================================================
// Floating "?" launcher button — bottom-right of every dashboard page.
//
// Sits at `right-4 bottom-20` to leave room above the AI chat widget that
// another agent is building.
//
// Clicking opens a menu listing every tour available to the current user on
// the current page:
//
//   - The role's welcome tour (manual-only).
//   - Page tours registered for the current path.
//   - All workflow tours.
//
// Page + workflow tours have a Manual / Interactive toggle.
// ============================================================================

function tourIcon(kind: Tour["kind"]) {
  switch (kind) {
    case "welcome":
      return MapIcon;
    case "page":
      return BookOpen;
    case "workflow":
      return Wand2;
  }
}

function tourSubtitle(tour: Tour): string {
  if (tour.kind === "welcome") return "About 2 minutes · Map of the whole app";
  if (tour.kind === "page") return "About 2-3 minutes · This page only";
  if (tour.kind === "workflow") {
    const mins = tour.estimatedMinutes ?? 5;
    return `About ${mins} min · Hands-on, I'll guide you`;
  }
  return "";
}

export function TourLauncher() {
  const { profile, appRole } = useUser();
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

  const tours = useMemo(
    () => getAllAvailableTours(pathname, appRole),
    [pathname, appRole]
  );

  // Don't render until we know who the user is.
  if (!profile) return null;
  if (tours.length === 0) return null;
  if (isTourActive) return null;

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
      <DropdownMenuContent
        align="end"
        side="top"
        className="w-80 p-0"
      >
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">
            What would you like to learn?
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick a tour. I&apos;ll walk you through it.
          </p>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {tours.map((tour) => {
            const Icon = tourIcon(tour.kind);
            const isWelcome = tour.kind === "welcome";
            const mode: TourMode = isWelcome
              ? "manual"
              : modes[tour.id] ?? "manual";
            return (
              <li
                key={tour.id}
                className="border-b last:border-b-0 px-4 py-3 hover:bg-accent/30"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tour.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {tourSubtitle(tour)}
                    </p>
                    {tour.description && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {tour.description}
                      </p>
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
                            onClick={() =>
                              setModes((m) => ({ ...m, [tour.id]: "manual" }))
                            }
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
                            onClick={() =>
                              setModes((m) => ({
                                ...m,
                                [tour.id]: "interactive",
                              }))
                            }
                          >
                            Interactive
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Read-only walkthrough
                        </span>
                      )}

                      <Button
                        size="sm"
                        onClick={() => {
                          setOpen(false);
                          window.setTimeout(
                            () => dispatchStartTour({ tourId: tour.id, mode }),
                            0
                          );
                        }}
                      >
                        Start
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
