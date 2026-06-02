import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Hoisted router mock — mutating `pushSpy` between tests lets us assert
// what (if anything) the shortcut routed to.
const { pushSpy } = vi.hoisted(() => ({ pushSpy: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

import { GlobalKeyboardShortcuts } from "@/components/GlobalKeyboardShortcuts";

describe("GlobalKeyboardShortcuts", () => {
  beforeEach(() => {
    pushSpy.mockReset();
    cleanup();
  });

  it("Alt+T routes to /notifications and prevents the browser default", () => {
    // Regression test for Bug 3 — Alt+T used to fall through to a
    // third-party widget's accessKey handler and blanked the page. The
    // global shortcut now intercepts in the capture phase and routes the
    // user to the full notifications view instead.
    render(<GlobalKeyboardShortcuts />);

    const event = new KeyboardEvent("keydown", {
      key: "t",
      altKey: true,
      cancelable: true,
      bubbles: true,
    });
    const prevented = !window.dispatchEvent(event);

    expect(prevented).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith("/notifications");
  });

  it("Alt+T with uppercase T also triggers (key matching is case-insensitive)", () => {
    render(<GlobalKeyboardShortcuts />);

    const event = new KeyboardEvent("keydown", {
      key: "T",
      altKey: true,
      cancelable: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(pushSpy).toHaveBeenCalledWith("/notifications");
  });

  it("does not navigate when Alt+T is combined with Ctrl or Meta", () => {
    // We only want the bare Alt+T chord — Ctrl+Alt+T is the GNOME shortcut
    // for opening a terminal, and we don't want to swallow that on Linux.
    render(<GlobalKeyboardShortcuts />);

    const event = new KeyboardEvent("keydown", {
      key: "t",
      altKey: true,
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("does not navigate or throw when a plain T is pressed", () => {
    render(<GlobalKeyboardShortcuts />);

    const event = new KeyboardEvent("keydown", {
      key: "t",
      altKey: false,
      cancelable: true,
      bubbles: true,
    });
    expect(() => window.dispatchEvent(event)).not.toThrow();
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
