"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  Plus,
  X,
  ScanLine,
  MessageCircle,
  HelpCircle,
  MessageSquareText,
} from "lucide-react";

import { useUser } from "@/lib/contexts/UserContext";
import { cn } from "@/lib/utils";
import { FloatingScanButton } from "@/components/scanner/FloatingScanButton";
import { AIChatWidget } from "@/components/ai-chat-widget";
import { TourPanel } from "@/components/tours/TourPanel";
import { TOUR_ACTIVE_CHANGED_EVENT } from "@/components/tours/TourProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * One floating button that expands into a speed-dial of the dashboard's
 * quick actions — Scan, AI assistant, Tours & help, and Send feedback —
 * replacing the four separate FABs that used to compete for the bottom-right
 * corner. The underlying panels (scanner dialog, AI chat panel, tour panel,
 * Sentry feedback form) are reused unchanged; only their triggers are unified.
 */
export function FloatingActionMenu() {
  const { profile } = useUser();
  const [expanded, setExpanded] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [toursOpen, setToursOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  // Sentry user-feedback is only present when the SDK initialized (DSN set).
  // Checked once at mount — the client SDK boots during app bootstrap, well
  // before this dashboard chrome renders.
  const [feedbackReady] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && Boolean(Sentry.getFeedback());
    } catch {
      return false;
    }
  });
  const feedbackBtnRef = useRef<HTMLButtonElement>(null);

  // Hide the cluster while a guided tour is running — its overlay owns the
  // screen. Mirrors the old standalone TourLauncher behavior.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ active: boolean }>;
      setIsTourActive(Boolean(ce.detail?.active));
    };
    window.addEventListener(TOUR_ACTIVE_CHANGED_EVENT, handler);
    return () => window.removeEventListener(TOUR_ACTIVE_CHANGED_EVENT, handler);
  }, []);

  // Wire Sentry's "open feedback form" onto our own menu item. The button only
  // exists in the DOM while expanded, so (re)attach whenever it appears.
  useEffect(() => {
    if (!expanded || !feedbackReady) return;
    const fb = Sentry.getFeedback();
    const el = feedbackBtnRef.current;
    if (!fb || !el) return;
    let detach: (() => void) | undefined;
    try {
      detach = fb.attachTo(el);
    } catch {
      // attachTo can throw if the integration isn't fully ready — ignore.
    }
    return () => {
      try {
        detach?.();
      } catch {
        /* no-op */
      }
    };
  }, [expanded, feedbackReady]);

  // Esc collapses the speed-dial.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (!profile) return null;

  return (
    <>
      {/* Trigger-less panels — opened by the speed-dial items below. */}
      <FloatingScanButton
        open={scanOpen}
        onOpenChange={setScanOpen}
        showTrigger={false}
      />
      <AIChatWidget open={aiOpen} onOpenChange={setAiOpen} showTrigger={false} />

      {/* Launcher cluster — hidden while a guided tour owns the screen. */}
      {!isTourActive && (
        <>
          {expanded && (
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setExpanded(false)}
            />
          )}

          <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
            {expanded && (
              <>
                <ActionItem
                  label="Scan VIN / Part"
                  icon={<ScanLine className="size-5" />}
                  onClick={() => {
                    setScanOpen(true);
                    setExpanded(false);
                  }}
                />
                <ActionItem
                  label="AI assistant"
                  icon={<MessageCircle className="size-5" />}
                  onClick={() => {
                    setAiOpen(true);
                    setExpanded(false);
                  }}
                />

                {/* Tours & help — opens the tour panel anchored to its button.
                    We keep the speed-dial expanded so the dropdown's anchor
                    stays mounted while it's open. */}
                <DropdownMenu open={toursOpen} onOpenChange={setToursOpen}>
                  <div className="flex animate-in items-center gap-2 fade-in slide-in-from-bottom-1 duration-150">
                    <ActionLabel>Tours &amp; help</ActionLabel>
                    <DropdownMenuTrigger asChild>
                      <ActionButton
                        aria-label="Tours and help"
                        data-tour-id="tour-launcher-button"
                      >
                        <HelpCircle className="size-5" />
                      </ActionButton>
                    </DropdownMenuTrigger>
                  </div>
                  <DropdownMenuContent
                    align="end"
                    side="top"
                    className="w-80 p-0"
                  >
                    <TourPanel onStarted={() => setToursOpen(false)} />
                  </DropdownMenuContent>
                </DropdownMenu>

                {feedbackReady && (
                  <ActionItem
                    buttonRef={feedbackBtnRef}
                    label="Send feedback"
                    icon={<MessageSquareText className="size-5" />}
                    onClick={() => setExpanded(false)}
                  />
                )}
              </>
            )}

            {/* Primary FAB */}
            <button
              type="button"
              aria-label={expanded ? "Close quick actions" : "Open quick actions"}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 sm:h-12 sm:w-12"
            >
              {expanded ? (
                <X className="size-7 sm:size-6" />
              ) : (
                <Plus className="size-7 sm:size-6" />
              )}
            </button>
          </div>
        </>
      )}
    </>
  );
}

function ActionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="bg-foreground text-background rounded-md px-2.5 py-1 text-xs font-medium shadow-md">
      {children}
    </span>
  );
}

const ActionButton = forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(
  function ActionButton({ className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95",
          className
        )}
        {...props}
      />
    );
  }
);

function ActionItem({
  label,
  icon,
  onClick,
  buttonRef,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="flex animate-in items-center gap-2 fade-in slide-in-from-bottom-1 duration-150">
      <ActionLabel>{label}</ActionLabel>
      <ActionButton ref={buttonRef} aria-label={label} onClick={onClick}>
        {icon}
      </ActionButton>
    </div>
  );
}
