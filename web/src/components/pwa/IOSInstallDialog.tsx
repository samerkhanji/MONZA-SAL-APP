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

interface IOSInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallDialog({ open, onOpenChange }: IOSInstallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Install on iPhone/iPad</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                  1
                </span>
                <div>
                  <p className="font-medium">Tap the Share button</p>
                  <p className="text-sm text-muted-foreground">
                    Tap the <Share className="inline size-4" /> icon at the bottom of Safari
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
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
