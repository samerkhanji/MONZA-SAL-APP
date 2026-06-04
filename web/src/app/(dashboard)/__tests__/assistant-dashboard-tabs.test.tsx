import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Mock the user context so the page does not redirect away.
vi.mock("@/lib/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { id: "u1", full_name: "Asst" },
    isRequestAssistant: true,
    isOwner: false,
    isHybrid: false,
    loading: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/error-messages", () => ({
  formatError: (e: unknown) => String(e),
}));

vi.mock("@/lib/supabase-profile", () => ({
  getProfileFullName: () => "Test User",
}));

vi.mock("@/components/ExportButton", () => ({
  ExportButton: () => null,
}));

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => unknown) => unknown;
};

// All Supabase queries on this page return empty result sets. The tab
// interaction we're testing doesn't depend on any of the loaded data.
function emptyBuilder(): QueryBuilder {
  const builder: Partial<QueryBuilder> = {};
  const methods = ["select", "eq", "neq", "is", "in", "order", "limit", "lt", "gte", "not"] as const;
  for (const m of methods) {
    builder[m] = vi.fn(() => builder as QueryBuilder);
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [], count: 0, error: null });
  return builder as QueryBuilder;
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "u1" } }, error: null }),
    },
    from: () => emptyBuilder(),
    rpc: vi.fn(),
  }),
}));

import AssistantDashboardPage from "@/app/(dashboard)/assistant-dashboard/page";

// jsdom doesn't implement scrollIntoView; stub it so tab clicks don't throw.
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("AssistantDashboardPage — tab bar", () => {
  beforeEach(() => {
    cleanup();
  });

  // The page renders two clickable elements for each section: the tab bar
  // button at the top, and the KPI summary card lower down. Both surface a
  // <button> with the same label. The tab bar buttons are the ones nested
  // inside the `border-b ... overflow-x-auto` strip, so we pick them out by
  // looking for buttons whose className includes the tab-bar's identifying
  // utility classes instead of by name alone.
  function getTabButtons() {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("button")
    );
    return buttons.filter(
      (b) =>
        b.className.includes("rounded-lg") &&
        b.className.includes("border") &&
        b.className.includes("px-4") &&
        b.className.includes("py-2") &&
        b.className.includes("text-sm")
    );
  }

  it("switches the active tab when each tab button is clicked", async () => {
    render(<AssistantDashboardPage />);

    // Wait until the tab strip has rendered.
    await waitFor(() => {
      expect(getTabButtons().length).toBeGreaterThanOrEqual(4);
    });

    const tabs = getTabButtons();
    const review = tabs.find((t) => /review requests/i.test(t.textContent ?? ""))!;
    const carsReady = tabs.find((t) => /cars ready/i.test(t.textContent ?? ""))!;
    const workshop = tabs.find((t) => /workshop overview/i.test(t.textContent ?? ""))!;

    // Initial active tab is "Review Requests" — its button has the
    // amber-active class. Bug 8: clicking another tab must update the
    // active highlight (and call scrollIntoView).
    expect(review.className).toMatch(/border-amber-500/);
    expect(carsReady.className).not.toMatch(/border-amber-500/);

    fireEvent.click(carsReady);
    await waitFor(() => {
      expect(carsReady.className).toMatch(/border-amber-500/);
      expect(review.className).not.toMatch(/border-amber-500/);
    });

    fireEvent.click(workshop);
    await waitFor(() => {
      expect(workshop.className).toMatch(/border-amber-500/);
      expect(carsReady.className).not.toMatch(/border-amber-500/);
    });
  });

  it("scrolls to the section ref on each tab click", async () => {
    render(<AssistantDashboardPage />);

    await waitFor(() => {
      expect(getTabButtons().length).toBeGreaterThanOrEqual(4);
    });

    const carsReadyTab = getTabButtons().find((t) =>
      /cars ready/i.test(t.textContent ?? "")
    )!;
    const scrollSpy = HTMLElement.prototype.scrollIntoView as unknown as ReturnType<
      typeof vi.fn
    >;
    const before = scrollSpy.mock.calls.length;
    fireEvent.click(carsReadyTab);
    expect(scrollSpy.mock.calls.length).toBeGreaterThan(before);
  });
});
