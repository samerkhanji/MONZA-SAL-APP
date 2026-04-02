import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";
import { useRouter, useSearchParams } from "next/navigation";

// Mock router + search params
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

// Mock ThemeContext so useTheme doesn't throw
vi.mock("@/lib/contexts/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", setTheme: () => {} }),
}));

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  }),
}));

describe.skip("LoginPage", () => {
  const originalEnv = { ...process.env };
  const push = vi.fn();

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
    (useRouter as unknown as any).mockReturnValue({ push });
    (useSearchParams as unknown as any).mockReturnValue({
      get: (_key: string) => null,
    });
    mockSignInWithPassword.mockReset();
    mockSignOut.mockReset();
    push.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("logs in successfully and redirects to dashboard", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
      expect(push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("shows error when credentials are invalid", async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login" },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrong" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
      // You may need to adjust this text to match whatever error you set in login/page.tsx
      expect(screen.getByText(/invalid login/i)).toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });
  });
});
