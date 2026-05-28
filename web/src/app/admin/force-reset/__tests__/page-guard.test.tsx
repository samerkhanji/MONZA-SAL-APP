import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Regression test for adversarial review #135 — the force-reset admin page
 * was reachable by any signed-in user, who could then sit in front of the
 * `ADMIN_API_SECRET` prompt and probe it. Page now renders an
 * "Access denied" card for non-owner roles even though the API also
 * enforces the secret.
 */

type UserMock = {
  loading: boolean;
  profile: { id: string; full_name: string } | null;
  isOwner: boolean;
};

let userMock: UserMock = { loading: false, profile: null, isOwner: false };

vi.mock("@/lib/contexts/UserContext", () => ({
  useUser: () => userMock,
}));

import AdminForceResetPage from "@/app/admin/force-reset/page";

function setUser(next: UserMock) {
  userMock = next;
}

describe("force-reset admin page route gate", () => {
  it("shows Access denied for an unauthenticated viewer", () => {
    setUser({ loading: false, profile: null, isOwner: false });
    render(<AdminForceResetPage />);
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    // Make sure the actual form is NOT in the DOM.
    expect(screen.queryByLabelText(/admin api secret/i)).toBeNull();
  });

  it("shows Access denied for a signed-in non-owner", () => {
    setUser({
      loading: false,
      profile: { id: "u1", full_name: "Sales Rep" },
      isOwner: false,
    });
    render(<AdminForceResetPage />);
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/admin api secret/i)).toBeNull();
  });

  it("renders the form for the owner role", () => {
    setUser({
      loading: false,
      profile: { id: "owner1", full_name: "Owner" },
      isOwner: true,
    });
    render(<AdminForceResetPage />);
    expect(screen.queryByText(/^access denied$/i)).toBeNull();
    expect(screen.getByLabelText(/admin api secret/i)).toBeInTheDocument();
  });
});
