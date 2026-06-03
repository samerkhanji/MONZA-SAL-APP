"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";

import { useUser } from "@/lib/contexts/UserContext";
import { TOUR_ACTIVE_CHANGED_EVENT } from "@/components/tours/TourProvider";
import { TourPanel } from "@/components/tours/TourPanel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Floating "?" button — bottom-right of every dashboard page. Opens TourPanel,
// which lists the current page's guide first, then related workflows, then the
// whole-app map (owners). Hidden while a tour is running.
export function TourLauncher() {
  const { profile } = useUser();
  const [open, setOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean }>;
      setIsTourActive(Boolean(ce.detail?.active));
    };
    window.addEventListener(TOUR_ACTIVE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TOUR_ACTIVE_CHANGED_EVENT, handler);
  }, []);

  if (!profile) return null;
  if (isTourActive) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="default"
          size="icon"
          aria-label="Tours and help"
          data-tour-id="tour-launcher-button"
          className={cn(
            "fixed right-4 bottom-20 z-40 size-12 rounded-full shadow-lg",
            "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <HelpCircle className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-80 p-0">
        <TourPanel onStarted={() => setOpen(false)} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
