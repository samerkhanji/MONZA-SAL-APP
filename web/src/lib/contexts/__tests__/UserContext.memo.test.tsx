import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

// Mock the Supabase client so UserProvider's effects don't try to hit the network.
const mockOnAuthStateChange = vi.fn(() => ({
  data: { subscription: { unsubscribe: () => {} } },
}));

const fakeQueryBuilder: any = {
  select: () => fakeQueryBuilder,
  eq: () => fakeQueryBuilder,
  single: () =>
    Promise.resolve({
      data: {
        id: "u1",
        full_name: "Test User",
        phone: null,
        user_role: "owner",
        capabilities: [],
        is_active: true,
      },
      error: null,
    }),
};

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getUser: () =>
        Promise.resolve({ data: { user: { id: "u1" } }, error: null }),
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: () => fakeQueryBuilder,
  }),
}));

import { UserProvider, useUser } from "@/lib/contexts/UserContext";

describe("UserContext provider value memoization", () => {
  it("returns the same context value reference across re-renders when state is unchanged", async () => {
    const seenValues: unknown[] = [];

    function Consumer() {
      const value = useUser();
      seenValues.push(value);
      return <div data-testid="consumer">{value.loading ? "L" : "R"}</div>;
    }

    function Wrapper({ tick }: { tick: number }) {
      // `tick` only changes the Wrapper subtree — it must NOT cause
      // UserProvider's value object to be rebuilt. Without useMemo on the
      // provider value, every Wrapper re-render also re-runs UserProvider
      // and produces a new value reference visible to Consumer.
      return (
        <UserProvider>
          <span data-testid="tick">{tick}</span>
          <Consumer />
        </UserProvider>
      );
    }

    const { rerender } = render(<Wrapper tick={0} />);

    // Let the async loadProfile promise chain settle so the initial render
    // burst (loading=true → loading=false + profile) finishes.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const stableValue = seenValues[seenValues.length - 1];

    // Force several parent re-renders that don't touch UserProvider state.
    rerender(<Wrapper tick={1} />);
    rerender(<Wrapper tick={2} />);
    rerender(<Wrapper tick={3} />);

    const finalValue = seenValues[seenValues.length - 1];

    // Regression guarantee: the provider value is referentially stable when
    // none of its dependencies have changed. If a future refactor drops the
    // useMemo wrapper, this assertion will fail and all ~70 useUser()
    // consumers will silently start re-rendering on every UserProvider
    // re-render.
    expect(finalValue).toBe(stableValue);
  });
});
