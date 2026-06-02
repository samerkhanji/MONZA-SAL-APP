import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// Owner profile — covers Bug 6 (owner submitting on behalf of themselves
// must still see Management Actions).
const OWNER_ID = "owner-1";

vi.mock("@/lib/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { id: OWNER_ID, full_name: "Owner Test" },
    appRole: "owner",
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/error-messages", () => ({
  formatError: (e: unknown) => String(e),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
  createNotificationsForUsers: vi.fn(),
}));

vi.mock("@/lib/user-lookup", () => ({
  getAllProfiles: () =>
    Promise.resolve([
      { id: OWNER_ID, full_name: "Owner Test" },
      { id: "asst-1", full_name: "Asst One" },
    ]),
  getProfileIdsByRole: () => Promise.resolve([]),
  getOwnerIds: () => Promise.resolve([OWNER_ID]),
}));

// Dynamic loader for scanner is unused in this test surface; keep the
// import side-effect-free by returning a stub.
vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));

vi.mock("@/components/ExportButton", () => ({
  ExportButton: () => null,
}));

// Single owner-submitted request, status awaiting_approval, submitter is the
// current user. Bug 6 regression: the Management Actions buttons must still
// render even though `request.submitted_by === currentUser.id`.
const OWN_REQUEST = {
  id: "req-own-1",
  subject: "My own urgent request",
  description: "Need approval on this",
  category: null,
  vin: null,
  status: "awaiting_approval",
  priority: "urgent",
  submitted_by: OWNER_ID,
  assigned_to: null,
  reviewed_by: null,
  send_to: "houssam",
  send_to_user_id: OWNER_ID,
  assistant_notes: null,
  management_comments: null,
  forwarded_at: null,
  resolved_at: null,
  created_at: new Date().toISOString(),
  updated_at: null,
};

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: (resolve: (v: unknown) => unknown) => unknown;
};

function makeRequestsQueryBuilder(): QueryBuilder {
  const builder: Partial<QueryBuilder> = {};
  const methods = ["select", "eq", "neq", "is", "in", "order", "limit"] as const;
  for (const m of methods) {
    builder[m] = vi.fn(() => builder as QueryBuilder);
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: [OWN_REQUEST], error: null });
  return builder as QueryBuilder;
}

function makeProfilesQueryBuilder(): QueryBuilder {
  const builder: Partial<QueryBuilder> = {};
  const methods = ["select", "eq", "neq", "is", "in", "order", "limit"] as const;
  for (const m of methods) {
    builder[m] = vi.fn(() => builder as QueryBuilder);
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve({
      data: [{ id: OWNER_ID, full_name: "Owner Test" }],
      error: null,
    });
  return builder as QueryBuilder;
}

const mockFrom = vi.fn((table: string) => {
  if (table === "requests") return makeRequestsQueryBuilder();
  if (table === "profiles") return makeProfilesQueryBuilder();
  return makeProfilesQueryBuilder();
});

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: OWNER_ID } }, error: null }),
    },
    from: mockFrom,
    rpc: vi.fn(),
  }),
}));

import RequestCenterPage from "@/app/(dashboard)/requests/page";

describe("RequestCenterPage", () => {
  beforeEach(() => {
    cleanup();
    mockFrom.mockClear();
  });

  it("renders the 'New Request' button without a pointer-events-blocking ancestor", async () => {
    render(<RequestCenterPage />);

    const button = await screen.findByRole("button", { name: /new request/i });
    expect(button).toBeInTheDocument();

    // Bug 5: the New Request button used to silently fail when a real mouse
    // clicked it because an ancestor had `pointer-events: none` from a
    // leftover dialog overlay. Walk the parent chain and assert that
    // pointer-events isn't disabled on any ancestor.
    let el: HTMLElement | null = button;
    while (el && el !== document.body) {
      const cs = window.getComputedStyle(el);
      expect(cs.pointerEvents).not.toBe("none");
      el = el.parentElement;
    }
  });

  it("opens the New Request modal on click", async () => {
    render(<RequestCenterPage />);

    const button = await screen.findByRole("button", { name: /new request/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /new request/i })
      ).toBeInTheDocument();
    });
  });

  it("shows Management Actions on the owner's OWN awaiting-approval request", async () => {
    render(<RequestCenterPage />);

    // Wait for the request row to populate.
    const row = await screen.findByText(/my own urgent request/i);
    expect(row).toBeInTheDocument();
    fireEvent.click(row);

    // Management Actions block should render even though
    // `submitted_by === currentUser.id`. Bug 6 was that this was hidden by
    // an over-eager submitter check.
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /management actions/i })
      ).toBeInTheDocument();
    });

    // And the action buttons must be present.
    expect(screen.getAllByRole("button", { name: /approve/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /reject/i }).length).toBeGreaterThan(0);
  });

  it("accepts a valid From-date input value without 'year-appending' corruption", async () => {
    render(<RequestCenterPage />);
    const from = (await screen.findByLabelText(/filter from date/i)) as HTMLInputElement;

    // Bug 7: simulate typing a clean ISO date — the controlled value must
    // round-trip exactly, not get a digit appended.
    fireEvent.change(from, { target: { value: "2026-06-02" } });
    expect(from.value).toBe("2026-06-02");

    // And a malformed value (the symptom: year segment that ends up too
    // long) gets clamped back to a sensible state rather than persisted.
    fireEvent.change(from, { target: { value: "22026-01-01" } });
    expect(from.value).not.toBe("22026-01-01");
  });
});
