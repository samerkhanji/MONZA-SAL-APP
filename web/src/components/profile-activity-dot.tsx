"use client";

import { cn } from "@/lib/utils";

export type ActivityPresence = "active" | "idle" | "offline" | "unknown";

export function getActivityPresence(
  lastActiveAt: string | null | undefined
): { presence: ActivityPresence; title: string } {
  if (!lastActiveAt) {
    return { presence: "unknown", title: "No session recorded (not logged in on this app yet)" };
  }
  const ms = Date.now() - new Date(lastActiveAt).getTime();
  if (Number.isNaN(ms) || ms < 0) {
    return { presence: "unknown", title: "No session recorded" };
  }
  const minutes = ms / 60_000;
  if (minutes <= 5) return { presence: "active", title: "Active in the last 5 minutes" };
  if (minutes <= 30) return { presence: "idle", title: "Active 5–30 minutes ago" };
  return { presence: "offline", title: "Offline (30+ minutes ago)" };
}

export function ProfileActivityDot({
  lastActiveAt,
  className,
}: {
  lastActiveAt: string | null | undefined;
  className?: string;
}) {
  const { presence, title } = getActivityPresence(lastActiveAt);
  if (presence === "unknown") {
    return (
      <span
        className={cn(
          "inline-block size-2.5 shrink-0 rounded-full border-2 border-muted-foreground/45 bg-transparent",
          className
        )}
        title={title}
        aria-label={title}
      />
    );
  }
  const color =
    presence === "active"
      ? "bg-green-500"
      : presence === "idle"
        ? "bg-yellow-500"
        : "bg-gray-400";
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", color, className)}
      title={title}
      aria-label={title}
    />
  );
}
