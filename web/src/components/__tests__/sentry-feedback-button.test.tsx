import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// The exact shape we'll let Sentry.getFeedback return per test. Mutating
// this lets us flip between "SDK initialized" and "no DSN / no client".
const { feedbackState } = vi.hoisted(() => ({
  feedbackState: {
    feedback: null as null | {
      createWidget: () => {
        el: HTMLElement;
        removeFromDom: () => void;
      };
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  getFeedback: () => feedbackState.feedback,
}));

import { SentryFeedbackButton } from "@/components/sentry-feedback-button";

describe("SentryFeedbackButton", () => {
  beforeEach(() => {
    feedbackState.feedback = null;
    cleanup();
  });

  it("renders nothing and skips widget creation when Sentry SDK is uninitialized", () => {
    // No DSN → Sentry client never registers the integration → getFeedback()
    // returns undefined. The component must NOT attempt to render a broken
    // widget; the dashboard layout should look identical to a Sentry-free
    // build.
    feedbackState.feedback = null;

    const { container } = render(<SentryFeedbackButton />);

    expect(container.firstChild).toBeNull();
  });

  it("creates the widget on mount and removes it on unmount when Sentry is active", () => {
    const removeFromDom = vi.fn();
    const widgetEl = document.createElement("button");
    const createWidget = vi.fn(() => ({ el: widgetEl, removeFromDom }));

    feedbackState.feedback = { createWidget };

    const { unmount } = render(<SentryFeedbackButton />);

    // Widget is created exactly once during mount.
    expect(createWidget).toHaveBeenCalledTimes(1);

    // Component repositions the actor button to the bottom-left so it
    // doesn't collide with the FloatingScanButton / TourLauncher / AI chat
    // bubble that already live in the bottom-right.
    expect(widgetEl.style.getPropertyValue("--inset")).toBe("auto auto 0 0");

    unmount();

    // Cleanup tears the widget back down so we don't leak a duplicate
    // button after route changes.
    expect(removeFromDom).toHaveBeenCalledTimes(1);
  });
});
