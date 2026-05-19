"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { driver, type Config, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

import { useUser } from "@/lib/contexts/UserContext";
import { createClient } from "@/lib/supabase";
import {
  getTourById,
  getWelcomeTourForRole,
} from "@/lib/tours/registry";
import type { Tour, TourMode, TourStep } from "@/lib/tours/types";

// ============================================================================
// Public event API
//
//   monza:tour-replay              — back-compat. Runs the role's welcome tour
//                                    in manual mode (same as today's avatar
//                                    menu).
//   monza:start-tour { id, mode }  — start a specific tour by id, in the
//                                    given mode.
// ============================================================================

const TOUR_REPLAY_EVENT = "monza:tour-replay";
const TOUR_START_EVENT = "monza:start-tour";

export type StartTourDetail = {
  tourId: string;
  mode?: TourMode;
};

export function dispatchTourReplay(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOUR_REPLAY_EVENT));
}

export function dispatchStartTour(detail: StartTourDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<StartTourDetail>(TOUR_START_EVENT, { detail })
  );
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Polls the DOM for `selector`, calling `onFound` when it appears. Used after
 * a `navigateTo` push so we can wait for the destination page to mount its
 * `data-tour-id` elements before highlighting.
 *
 * MutationObserver would also work, but polling is simpler and the cost is
 * trivial for the short windows we need (we give up after ~3s).
 */
function waitForElement(
  selector: string,
  timeoutMs = 3000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        window.clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
}

// ============================================================================
// Component
// ============================================================================

/**
 * Headless tour runner. Mount once inside the dashboard shell.
 *
 * Responsibilities:
 *   1. Auto-fires the role-appropriate welcome tour on first login (when
 *      `profile.onboarding_completed === false`). Manual mode.
 *   2. Marks `onboarding_completed = true` when the welcome tour finishes or
 *      is dismissed.
 *   3. Listens for `monza:tour-replay` — back-compat for the avatar menu —
 *      runs the welcome tour in manual mode.
 *   4. Listens for `monza:start-tour` { tourId, mode } from the
 *      `<TourLauncher />` to start any specific tour in either mode.
 *
 * Interactive-mode plumbing:
 *   - Hides driver.js' Next button (`showButtons: ["previous", "close"]`).
 *   - When a step has `waitFor: "click"`, attaches a `click` listener to the
 *     highlighted element and advances on fire.
 *   - When a step has `waitFor: "input"`, listens for the `input` event.
 *   - When a step has `waitFor: "navigation"`, listens for Next.js'
 *     `popstate` + a polling tick on `window.location.pathname`.
 *
 * Navigation between steps:
 *   - If a step has `navigateTo`, the runner calls `router.push()` and waits
 *     for the element to mount before highlighting.
 *
 * Mode switching:
 *   - The popover footer gets a small "Switch to manual / interactive" link.
 *     Clicking it tears down the current driver and rebuilds at the same step
 *     index in the other mode.
 *
 * It renders nothing — driver.js paints its own DOM directly on the page.
 */
export function OnboardingTour() {
  const { profile } = useUser();
  const router = useRouter();
  const hasAutoFiredRef = useRef(false);

  // Hold the active driver instance so we can tear it down on mode switch.
  const driverRef = useRef<Driver | null>(null);
  // Cleanup function for the current interactive listener (if any).
  const interactiveCleanupRef = useRef<(() => void) | null>(null);
  // Self-ref so the popover's mode-switch click handler can call runTour
  // without creating a self-reference cycle (the lint rule for hooks rejects
  // the natural form). The React Compiler memoizes the function for us.
  const runTourRef = useRef<
    ((tour: Tour, mode: TourMode, markCompleteAfter: boolean, startAt?: number) => void) | null
  >(null);

  const runTour = (
    tour: Tour,
    mode: TourMode,
    markCompleteAfter: boolean,
    startAt = 0
  ) => {
      // Tear down any previous instance + listeners.
      if (interactiveCleanupRef.current) {
        interactiveCleanupRef.current();
        interactiveCleanupRef.current = null;
      }
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }

      const isInteractive = mode === "interactive";

      // Build the driver.js step list. We resolve elements lazily (via a
      // function) so navigateTo can fire before we read the DOM.
      const driveSteps: DriveStep[] = tour.steps.map((step, idx) =>
        buildDriveStep(step, idx, tour.steps.length, tour, isInteractive)
      );

      const config: Config = {
        showProgress: true,
        progressText: "{{current}} / {{total}}",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        doneBtnText: "Finish",
        allowClose: true,
        showButtons: isInteractive
          ? ["previous", "close"]
          : ["next", "previous", "close"],
        smoothScroll: true,
        steps: driveSteps,
        // After every step renders, paint mode UI + (re-)wire interactive
        // listeners.
        onHighlighted: (_el, _step, opts) => {
          renderFooterMode(opts.state.popover, mode, () => {
            const newMode: TourMode = isInteractive ? "manual" : "interactive";
            const currentIdx = opts.driver.getActiveIndex() ?? 0;
            runTourRef.current?.(tour, newMode, markCompleteAfter, currentIdx);
          });

          // Wire up interactive auto-advance.
          if (interactiveCleanupRef.current) {
            interactiveCleanupRef.current();
            interactiveCleanupRef.current = null;
          }
          if (isInteractive) {
            const stepIdx = opts.driver.getActiveIndex() ?? 0;
            const tourStep = tour.steps[stepIdx];
            interactiveCleanupRef.current = wireInteractiveStep(
              tourStep,
              opts.driver
            );
          }
        },
        // Some steps require navigation before they can render — handle here.
        onHighlightStarted: async (_el, _step, opts) => {
          const stepIdx = opts.driver.getActiveIndex() ?? 0;
          const tourStep = tour.steps[stepIdx];
          if (tourStep.navigateTo && tourStep.navigateTo !== window.location.pathname) {
            router.push(tourStep.navigateTo);
            // Wait for the element to mount (if there is one).
            if (tourStep.element) {
              await waitForElement(tourStep.element, 3000);
              opts.driver.refresh();
            }
          }
        },
        onDestroyed: async () => {
          if (interactiveCleanupRef.current) {
            interactiveCleanupRef.current();
            interactiveCleanupRef.current = null;
          }
          driverRef.current = null;
          if (!markCompleteAfter || !profile?.id) return;
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
            // swallow — tour will re-fire next login but user can dismiss again
          }
        },
      };

      const d = driver(config);
      driverRef.current = d;

      // If the first step needs navigation, push first, then drive.
      const firstStep = tour.steps[startAt];
      const needsNav =
        firstStep?.navigateTo && firstStep.navigateTo !== window.location.pathname;
      if (needsNav && firstStep.navigateTo) {
        router.push(firstStep.navigateTo);
        const sel = firstStep.element;
        if (sel) {
          waitForElement(sel, 3000).then(() => d.drive(startAt));
        } else {
          window.setTimeout(() => d.drive(startAt), 400);
        }
      } else {
        d.drive(startAt);
      }
    };

  // Keep the ref pointed at the latest runTour so the popover's mode-switch
  // closure (captured at driver.js config build time) can invoke the
  // most-recent version. No dep array on purpose — runTour is a fresh
  // closure each render.
  useEffect(() => {
    runTourRef.current = runTour;
  });

  // --------------------------------------------------------------------------
  // Auto-fire on first login.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!profile || hasAutoFiredRef.current) return;
    if (profile.onboarding_completed) return;
    const tour = getWelcomeTourForRole(profile.user_role);
    if (!tour) return;
    hasAutoFiredRef.current = true;
    const t = setTimeout(
      () => runTourRef.current?.(tour, "manual", /* markCompleteAfter */ true),
      500
    );
    return () => clearTimeout(t);
  }, [profile]);

  // --------------------------------------------------------------------------
  // monza:tour-replay (back-compat for the avatar menu item).
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!profile) return;
    const handler = () => {
      const tour = getWelcomeTourForRole(profile.user_role);
      if (!tour) return;
      runTourRef.current?.(tour, "manual", /* markCompleteAfter */ false);
    };
    window.addEventListener(TOUR_REPLAY_EVENT, handler);
    return () => window.removeEventListener(TOUR_REPLAY_EVENT, handler);
  }, [profile]);

  // --------------------------------------------------------------------------
  // monza:start-tour { tourId, mode } from the launcher.
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!profile) return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<StartTourDetail>;
      const { tourId, mode = "manual" } = ce.detail ?? { tourId: "" };
      if (!tourId) return;
      const tour = getTourById(tourId);
      if (!tour) return;
      // Welcome tour stays manual-only — enforce in case launcher slips.
      const effectiveMode: TourMode =
        tour.kind === "welcome" ? "manual" : mode;
      const markComplete = tour.kind === "welcome";
      runTourRef.current?.(tour, effectiveMode, markComplete);
    };
    window.addEventListener(TOUR_START_EVENT, handler);
    return () => window.removeEventListener(TOUR_START_EVENT, handler);
  }, [profile]);

  // Tear down on unmount.
  useEffect(() => {
    return () => {
      if (interactiveCleanupRef.current) interactiveCleanupRef.current();
      if (driverRef.current) driverRef.current.destroy();
    };
  }, []);

  return null;
}

// ============================================================================
// Step builder
// ============================================================================

function buildDriveStep(
  step: TourStep,
  idx: number,
  total: number,
  _tour: Tour,
  isInteractive: boolean
): DriveStep {
  const popoverDescription = isInteractive && step.element
    ? `${step.description}\n\n→ ${interactiveHint(step.waitFor)}`
    : step.description;

  // We pass the element as a getter so driver.js re-resolves it after a
  // navigation (the DOM may not have existed at config-build time).
  const elementGetter = step.element
    ? () => {
        const el = document.querySelector(step.element!);
        return (el as Element) ?? document.body;
      }
    : undefined;

  const driveStep: DriveStep = {
    element: elementGetter as DriveStep["element"],
    popover: {
      title: step.title,
      description: popoverDescription,
      side: step.side ?? "right",
      align: step.align ?? "start",
      // For interactive steps with a waitFor, hide the Next button (the user
      // has to actually do the thing to advance). The "previous" + "close"
      // buttons remain so they don't get stuck.
      showButtons:
        isInteractive && step.waitFor
          ? ["previous", "close"]
          : isInteractive
            ? ["previous", "close"]
            : ["next", "previous", "close"],
      progressText: `${idx + 1} / ${total}`,
    },
  };

  return driveStep;
}

function interactiveHint(waitFor: TourStep["waitFor"]): string {
  switch (waitFor) {
    case "click":
      return "Click the highlighted element to continue.";
    case "input":
      return "Type into the highlighted field to continue.";
    case "navigation":
      return "Submit / navigate to continue.";
    default:
      return "Do the action when you're ready.";
  }
}

// ============================================================================
// Interactive-mode listener wiring.
//
// Returns a cleanup function (always safe to call).
// ============================================================================

function wireInteractiveStep(step: TourStep, drv: Driver): () => void {
  if (!step.waitFor) return () => {};

  // Modal steps (no element) can't be "interactive"; just no-op.
  if (!step.element) return () => {};

  if (step.waitFor === "navigation") {
    const startPath = window.location.pathname;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      if (window.location.pathname !== startPath) {
        stopped = true;
        drv.moveNext();
        return;
      }
      window.setTimeout(tick, 200);
    };
    window.setTimeout(tick, 200);
    return () => {
      stopped = true;
    };
  }

  const el = document.querySelector(step.element);
  if (!el) return () => {};

  const eventName = step.waitFor === "click" ? "click" : "input";
  let fired = false;
  const handler = () => {
    if (fired) return;
    fired = true;
    // Small debounce so the user actually sees their action register.
    window.setTimeout(() => drv.moveNext(), 250);
  };
  el.addEventListener(eventName, handler, { once: true });

  return () => {
    el.removeEventListener(eventName, handler);
  };
}

// ============================================================================
// Mode-switch UI injected into the popover footer.
// ============================================================================

function renderFooterMode(
  popover: { footer: HTMLElement } | undefined,
  mode: TourMode,
  onToggle: () => void
): void {
  if (!popover?.footer) return;

  // Remove any prior injection (driver.js rebuilds the popover per step but
  // be defensive in case the same DOM is reused).
  const prior = popover.footer.querySelector(
    '[data-monza-tour-mode-toggle="1"]'
  );
  if (prior) prior.remove();

  const wrap = document.createElement("div");
  wrap.setAttribute("data-monza-tour-mode-toggle", "1");
  wrap.style.cssText =
    "display:flex;align-items:center;gap:6px;margin-right:auto;font-size:11px;color:#64748b;";

  const label = document.createElement("span");
  label.textContent =
    mode === "interactive" ? "Interactive" : "Manual";
  label.style.cssText = "font-weight:600;";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent =
    mode === "interactive"
      ? "Switch to manual"
      : "Switch to interactive";
  btn.style.cssText =
    "background:none;border:none;padding:0;color:#2563eb;cursor:pointer;text-decoration:underline;font-size:11px;";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  });

  wrap.appendChild(label);
  wrap.appendChild(btn);

  // Insert at the start of the footer so the buttons stay on the right.
  popover.footer.insertBefore(wrap, popover.footer.firstChild);
}
