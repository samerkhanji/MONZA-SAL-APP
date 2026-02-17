"use client";

import {
  createContext,
  useCallback,
  useContext,
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

  return (
    <InstallContext.Provider
      value={{
        showInstallOption,
        canInstallNative,
        triggerInstall,
      }}
    >
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
