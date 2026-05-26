import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// Stub the install prompt hook with a stable return — values are constants so
// every re-render of InstallProvider sees the same inputs (including a stable
// `install` function identity). Using vi.hoisted so the value is available at
// the hoisted vi.mock factory call time.
const { stableHookReturn } = vi.hoisted(() => ({
  stableHookReturn: {
    isIOS: false,
    install: () => {},
    canInstallNative: false,
    showInstallOption: false,
    platform: "other" as const,
  },
}));

vi.mock("@/hooks/use-install-prompt", () => ({
  useInstallPrompt: () => stableHookReturn,
}));

// Stub PWA dialogs to avoid pulling in Radix portals during the unit test.
vi.mock("@/components/pwa/IOSInstallDialog", () => ({
  IOSInstallDialog: () => null,
}));
vi.mock("@/components/pwa/InstallInstructionsDialog", () => ({
  InstallInstructionsDialog: () => null,
}));

import { InstallProvider, useInstall } from "@/lib/contexts/InstallContext";

function ContextValueProbe({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useInstall>) => void;
}) {
  const value = useInstall();
  onValue(value);
  return null;
}

describe("InstallContext", () => {
  it("provider value identity is stable across re-renders when inputs don't change", () => {
    const captured: ReturnType<typeof useInstall>[] = [];
    const { rerender } = render(
      <InstallProvider>
        <ContextValueProbe onValue={(v) => captured.push(v)} />
      </InstallProvider>
    );
    // Re-render the provider with the same children prop.
    act(() => {
      rerender(
        <InstallProvider>
          <ContextValueProbe onValue={(v) => captured.push(v)} />
        </InstallProvider>
      );
    });
    // We expect at least two captures and the same reference identity for the
    // memoized provider value (this guards the useMemo fix).
    expect(captured.length).toBeGreaterThanOrEqual(2);
    expect(captured[0]).toBe(captured[captured.length - 1]);
  });
});
