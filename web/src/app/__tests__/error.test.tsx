import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import RootError from "@/app/error";

describe("app/error.tsx (root error boundary)", () => {
  it("does NOT render its own <html>/<body> wrapper", () => {
    // Route-level error boundaries render inside the root layout, which already
    // provides <html>/<body>. Wrapping again is invalid DOM and produces
    // hydration warnings at the exact moment the user is already seeing an
    // error. Only `app/global-error.tsx` may render its own <html>/<body>.
    const { container } = render(
      <RootError error={new Error("boom")} reset={vi.fn()} />
    );

    // The component must not introduce a fresh document wrapper.
    expect(container.querySelector("html")).toBeNull();
    expect(container.querySelector("body")).toBeNull();

    // It must still render the user-facing fallback content.
    expect(container.textContent).toMatch(/Something went wrong/);
  });
});
