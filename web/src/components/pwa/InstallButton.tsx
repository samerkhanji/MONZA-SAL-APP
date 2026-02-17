"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstall } from "@/lib/contexts/InstallContext";

const DISMISSED_KEY = "monza-install-dismissed";

export function useInstallDismissed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISSED_KEY) === "true";
}

export function setInstallDismissed() {
  if (typeof window !== "undefined") {
    localStorage.setItem(DISMISSED_KEY, "true");
  }
}

interface InstallButtonProps {
  variant?: "default" | "outline" | "ghost" | "link" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | "xs";
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}

export function InstallButton({
  variant = "default",
  size = "default",
  className,
  showIcon = true,
  children,
}: InstallButtonProps) {
  const { showInstallOption, triggerInstall } = useInstall();

  if (!showInstallOption) return null;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => triggerInstall()}
    >
      {showIcon && <Download className="size-4" />}
      {children ?? "Install App"}
    </Button>
  );
}
