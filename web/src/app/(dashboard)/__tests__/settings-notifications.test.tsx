import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

const { stableUser } = vi.hoisted(() => ({
  stableUser: { profile: { id: "u1", full_name: "Test" } },
}));

vi.mock("@/lib/contexts/UserContext", () => ({
  useUser: () => stableUser,
}));

// `vi.mock` factories run before module-level `const`s are initialized, so
// any shared state needs to live inside `vi.hoisted`.
const { toastError, toastInfo, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, info: toastInfo, success: toastSuccess, warning: vi.fn() },
}));

vi.mock("@/lib/error-messages", () => ({
  formatError: (e: unknown) => String(e),
}));

const PREFS_DATA = {
  user_id: "u1",
  in_app_enabled: true,
  email_enabled: false,
  whatsapp_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  digest_categories: [],
  muted_entity_keys: [],
  desktop_push: false,
  sound_on_critical: false,
};

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown
  ) => unknown;
};

function prefsBuilder(): QueryBuilder {
  const result = { data: PREFS_DATA, error: null };
  const builder: Partial<QueryBuilder> = {};
  builder.select = vi.fn(() => builder as QueryBuilder);
  builder.eq = vi.fn(() => builder as QueryBuilder);
  builder.update = vi.fn(() => builder as QueryBuilder);
  builder.insert = vi.fn(() => builder as QueryBuilder);
  // Both single() and maybeSingle() act as terminal operators that resolve
  // to the canned row. They must return a real Promise (not a thenable) so
  // the page's `await ... .maybeSingle()` settles inside React's act batch.
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  // For non-select chains (e.g. update) the chain itself is awaited.
  builder.then = (
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown
  ) => {
    return Promise.resolve({ data: null, error: null }).then(resolve, reject);
  };
  return builder as QueryBuilder;
}

// The real supabase factory is a module-level singleton, so we mirror that
// here. Returning a fresh client object on every call would cause callers
// using `createClient()` in render to re-run useCallback dependencies and
// loop forever inside the page's load effect.
const { supabaseSingleton } = vi.hoisted(() => {
  return {
    supabaseSingleton: {} as Record<string, unknown>,
  };
});

vi.mock("@/lib/supabase", () => ({
  createClient: () => supabaseSingleton,
}));

// Fill in the singleton after the mock factory runs. `from` returns a fresh
// builder each call so chain state is per-query.
supabaseSingleton.auth = {
  getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }),
};
supabaseSingleton.from = () => prefsBuilder();

import NotificationPreferencesPage from "@/app/(dashboard)/settings/notifications/page";

describe("NotificationPreferencesPage — mute input validation", () => {
  beforeEach(() => {
    cleanup();
    toastError.mockClear();
    toastInfo.mockClear();
    toastSuccess.mockClear();
  });

  it("shows a validation toast when the user submits an empty mute key via Enter", async () => {
    render(<NotificationPreferencesPage />);

    const input = (await screen.findByPlaceholderText(
      /entity_type:uuid/i
    )) as HTMLInputElement;

    // Press Enter on a blank input. Bug 10: this used to silently no-op.
    // Now it must surface a toast explaining the requirement.
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });

    // The error message must specifically mention the entity-ID
    // requirement so it's actionable.
    const firstCall = toastError.mock.calls[0];
    expect(String(firstCall[0])).toMatch(/entity id/i);
  });

  it("also shows a validation toast when the input has only whitespace", async () => {
    render(<NotificationPreferencesPage />);

    const input = (await screen.findByPlaceholderText(
      /entity_type:uuid/i
    )) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
  });
});
