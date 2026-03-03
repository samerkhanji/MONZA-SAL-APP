"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { getOnboardingSteps } from "@/lib/onboarding";

export function OnboardingTour() {
  const { profile, appRole } = useUser();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const highlightRef = useRef<HTMLElement | null>(null);

  const steps = getOnboardingSteps(appRole ?? null);

  useEffect(() => {
    if (!profile) return;
    if (profile.must_change_password) return;
    if (profile.onboarding_completed) return;
    if (steps.length === 0) return;
    setOpen(true);
  }, [profile, steps.length]);

  useEffect(() => {
    if (!open || steps.length === 0) return;
    const step = steps[index];
    if (!step) return;
    if (highlightRef.current) {
      highlightRef.current.classList.remove("onboarding-highlight");
      highlightRef.current = null;
    }
    if (typeof document === "undefined") return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (el) {
      highlightRef.current = el;
      el.classList.add("onboarding-highlight");
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
    return () => {
      if (highlightRef.current) {
        highlightRef.current.classList.remove("onboarding-highlight");
        highlightRef.current = null;
      }
    };
  }, [open, index, steps]);

  async function completeTour() {
    if (!profile) {
      setOpen(false);
      return;
    }
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    setOpen(false);
  }

  if (!open || steps.length === 0) return null;

  const step = steps[index];
  const total = steps.length;

  return (
    <div className="pointer-events-none fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/40" />
      <div className="pointer-events-auto fixed inset-x-0 bottom-0 flex justify-center px-4 pb-6">
        <div className="max-w-xl w-full rounded-lg bg-background/95 p-4 shadow-lg border border-border">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {step.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              Step {index + 1} of {total}
            </p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {step.content}
          </p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:underline"
              onClick={completeTour}
            >
              Skip Tour
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                onClick={() => {
                  if (index === total - 1) {
                    void completeTour();
                  } else {
                    setIndex((i) => Math.min(total - 1, i + 1));
                  }
                }}
              >
                {index === total - 1 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

