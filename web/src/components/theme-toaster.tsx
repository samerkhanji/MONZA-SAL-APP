"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/contexts/ThemeContext";

export function ThemeToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      theme={theme}
      toastOptions={{
        className: "min-w-[280px] max-w-[calc(100vw-2rem)]",
      }}
    />
  );
}
