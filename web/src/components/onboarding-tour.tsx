"use client";

import { useCallback, useEffect, useRef } from "react";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

import { useUser } from "@/lib/contexts/UserContext";
import { createClient } from "@/lib/supabase";
import { getTourForRole } from "@/lib/tours/registry";
import type { Tour } from "@/lib/tours/types";

/**
 * Custom event dispatched from anywhere (e.g. the "Take the tour" menu item)
 * to replay the user's tour. The component listens for it on `window`.
 */
const TOUR_REPLAY_EVENT = "monza:tour-replay";

export function dispatchTourReplay(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_REPLAY_EVENT));
}

/**
 * Headless component. Mount once inside the dashboard shell. It:
 *
 *   1. Auto-fires the role-appropriate tour on first login (i.e. when
 *      `profile.onboarding_completed === false`).
 *   2. Marks `onboarding_completed = true` in the profile when the user
 *      finishes OR skips the tour. (Skipping still counts so they don't get
 *      re-prompted next time they refresh.)
 *   3. Listens for a `monza:tour-replay` window event so the avatar menu can
 *      replay the tour without remounting.
 *
 * It renders nothing — driver.js paints its own DOM directly on the page.
 */
export function OnboardingTour() {
  const { profile } = useUser();
  const hasAutoFiredRef = useRef(false);

  const runTour = useCallback(
    (tour: Tour, markCompleteAfter: boolean) => {
      const d: Driver = driver({
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Finish",
        allowClose: true,
        showButtons: ["next", "previous", "close"],
        // Avoid the page jumping all over the place: pin the highlight to the
        // viewport instead of scrolling each element fully into view.
        smoothScroll: true,
        steps: tour.steps.map((s) => ({
          element: s.element,
          popover: {
            title: s.title,
            description: s.description,
            side: s.side ?? "right",
            align: s.align ?? "start",
          },
        })),
        onDestroyed: async () => {
          if (!markCompleteAfter || !profile?.id) return;
          // Best-effort: if this fails (offline, RLS quirk), the tour still
          // re-fires next login but the user can dismiss it again. Don't
          // surface an error toast.
          try {
            const supabase = createClient();
            await supabase
              .from("profiles")
              .update({
                onboarding_completed: true,
                onboarding_completed_at: new Date().toISOString(),
              })
              .eq("id", profile.id);
          } catch {
            // swallow
          }
        },
      });
      d.drive();
    },
    [profile?.id]
  );

  // Auto-fire on first login. Use a ref so a profile refetch (e.g. after we
  // mark onboarding_completed) doesn't replay the tour on the same page load.
  useEffect(() => {
    if (!profile || hasAutoFiredRef.current) return;
    if (profile.onboarding_completed) return;
    const tour = getTourForRole(profile.user_role);
    if (!tour) return;
    hasAutoFiredRef.current = true;
    // Small delay so the layout has rendered and the highlighted elements
    // have real bounding boxes.
    const t = setTimeout(() => runTour(tour, /* markCompleteAfter */ true), 500);
    return () => clearTimeout(t);
  }, [profile, runTour]);

  // Replay event: triggered by the avatar menu.
  useEffect(() => {
    if (!profile) return;
    const tour = getTourForRole(profile.user_role);
    if (!tour) return;
    const handler = () => runTour(tour, /* markCompleteAfter */ false);
    window.addEventListener(TOUR_REPLAY_EVENT, handler);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, handler);
  }, [profile, runTour]);

  return null;
}
