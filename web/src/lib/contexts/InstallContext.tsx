"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { IOSInstallDialog } from "@/components/pwa/IOSInstallDialog";
import { InstallInstructionsDialog } from "@/components/pwa/InstallInstructionsDialog";

interface InstallContextValue {
  showInstallOption: boolean;
  canInstallNative: boolean;
  triggerInstall: () => void | Promise<void>;
}

const InstallContext = createContext<InstallContextValue | null>(null);

export function InstallProvider({ children }: { children: ReactNode }) {
  const {
    isIOS,
    install,
    canInstallNative,
    showInstallOption,
    platform,
  } = useInstallPrompt();
  const [iosDialogOpen, setIosDialogOpen] = useState(false);
  const [instructionsDialogOpen, setInstructionsDialogOpen] = useState(false);

  const triggerInstall = useCallback(async () => {
    if (canInstallNative) {
      await install();
    } else if (isIOS) {
      setIosDialogOpen(true);
    } else {
      setInstructionsDialogOpen(true);
    }
  }, [canInstallNative, install, isIOS]);

  // Memoize the provider value so consumers don't re-render when InstallProvider
  // re-renders for unrelated reasons (e.g. parent state changes).
  const contextValue = useMemo<InstallContextValue>(
    () => ({
      showInstallOption,
      canInstallNative,
      triggerInstall,
    }),
    [showInstallOption, canInstallNative, triggerInstall]
  );

  return (
    <InstallContext.Provider value={contextValue}>
      {children}
      <IOSInstallDialog open={iosDialogOpen} onOpenChange={setIosDialogOpen} />
      <InstallInstructionsDialog
        open={instructionsDialogOpen}
        onOpenChange={setInstructionsDialogOpen}
        platform={platform}
      />
    </InstallContext.Provider>
  );
}

export function useInstall() {
  const ctx = useContext(InstallContext);
  if (!ctx) {
    return {
      showInstallOption: false,
      canInstallNative: false,
      triggerInstall: () => {},
    };
  }
  return ctx;
}
