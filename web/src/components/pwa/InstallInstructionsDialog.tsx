"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Share } from "lucide-react";
import type { InstallPlatform } from "@/hooks/use-install-prompt";

interface InstallInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: InstallPlatform;
}

function ChromeInstruction() {
  return (
    <p className="text-sm text-muted-foreground">
      Click the install icon (⊕) in the address bar to add this app to your
      device.
    </p>
  );
}

function SafariIOSInstruction() {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
          1
        </span>
        <div>
          <p className="font-medium">Tap the Share button</p>
          <p className="text-sm text-muted-foreground">
            Tap the <Share className="inline size-4" /> icon at the bottom of
            Safari
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
          2
        </span>
        <div>
          <p className="font-medium">Add to Home Screen</p>
          <p className="text-sm text-muted-foreground">
            Scroll down and tap &quot;Add to Home Screen&quot;
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
          3
        </span>
        <div>
          <p className="font-medium">Confirm</p>
          <p className="text-sm text-muted-foreground">
            Tap &quot;Add&quot; to confirm
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        The app will appear on your home screen as &quot;Monza S.A.L.&quot;
      </p>
    </div>
  );
}

function OtherInstruction() {
  return (
    <p className="text-sm text-muted-foreground">
      Use your browser menu to add this app to your home screen or bookmarks for
      quick access.
    </p>
  );
}

export function InstallInstructionsDialog({
  open,
  onOpenChange,
  platform,
}: InstallInstructionsDialogProps) {
  const title =
    platform === "ios"
      ? "Install on iPhone/iPad"
      : platform === "chrome"
        ? "Install Monza S.A.L."
        : "Add to Home Screen";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="pt-2">
              {platform === "chrome" && <ChromeInstruction />}
              {platform === "ios" && <SafariIOSInstruction />}
              {(platform === "safari" || platform === "other") && (
                <OtherInstruction />
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
