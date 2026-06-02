import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

vi.mock("@/lib/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { id: "u1", full_name: "Test" },
    isOwner: false,
    isHoussam: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/error-messages", () => ({
  formatError: (e: unknown) => String(e),
}));

vi.mock("@/lib/delete-requests", () => ({
  approveDeleteRequest: vi.fn(),
  denyDeleteRequest: vi.fn(),
}));

vi.mock("@/lib/document-access", () => ({
  approveDocumentAccessRequest: vi.fn(),
  denyDocumentAccessRequest: vi.fn(),
}));

vi.mock("@/lib/page-access", () => ({
  approvePageAccessRequest: vi.fn(),
  denyPageAccessRequest: vi.fn(),
}));

vi.mock("@/hooks/use-app-badge", () => ({
  useAppBadge: () => {},
}));

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => unknown) => unknown;
};

// Empty notifications result and zero total — the panel must still open.
function emptyNotificationBuilder(): QueryBuilder {
  const builder: Partial<QueryBuilder> = {};
  builder.select = vi.fn(() => builder as QueryBuilder);
  builder.eq = vi.fn(() => builder as QueryBuilder);
  builder.is = vi.fn(() => builder as QueryBuilder);
  builder.or = vi.fn(() => builder as QueryBuilder);
  builder.order = vi.fn(() => builder as QueryBuilder);
  builder.limit = vi.fn(() => builder as QueryBuilder);
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [], count: 0, error: null });
  return builder as QueryBuilder;
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
    from: () => emptyNotificationBuilder(),
    rpc: vi.fn(),
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

import { NotificationBell } from "@/components/NotificationBell";

describe("NotificationBell — empty state", () => {
  beforeEach(() => {
    cleanup();
  });

  it("opens the dropdown panel with the empty-state message when there are no notifications", async () => {
    render(<NotificationBell />);

    // Wait for the initial empty fetch to settle so unreadCount stays at 0
    // (which means the red badge is not rendered).
    await waitFor(() => {
      // The Bell trigger button itself is always present.
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    // Bug 9: the bell must open even when there are no notifications and
    // no unread badge. Previously the trigger silently no-op'd when the
    // notifications array was empty.
    const trigger = screen.getByRole("button");

    // Radix DropdownMenu listens for pointerdown + click (not just click)
    // to open the menu, so fire both to mimic a real user interaction.
    fireEvent.pointerDown(trigger, {
      pointerType: "mouse",
      button: 0,
    });
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText(/you're all caught up/i)).toBeInTheDocument();
    });
  });
});
