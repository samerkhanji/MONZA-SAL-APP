"use client";

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: "amber" | "green" | "red";
  onClick?: () => void;
  className?: string;
}

export function KpiCard({ label, value, icon: Icon, color, onClick, className }: KpiCardProps) {
  const content = (
    <>
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg xl:h-10 xl:w-10",
          color === "amber" && "bg-amber-500/10",
          color === "green" && "bg-green-500/10",
          color === "red" && "bg-red-500/10"
        )}
      >
        <Icon
          className={cn(
            "size-5",
            color === "amber" && "text-amber-500",
            color === "green" && "text-green-500",
            color === "red" && "text-red-500"
          )}
        />
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none xl:text-3xl">{value}</p>
        <p className="mt-1 text-xs leading-tight text-muted-foreground xl:text-sm">{label}</p>
      </div>
    </>
  );

  const baseClasses = cn(
    "flex min-h-[100px] flex-col gap-3 rounded-xl border border-border bg-card p-4 xl:min-h-[120px] xl:p-5 2xl:p-6",
    onClick && "cursor-pointer transition-colors hover:bg-muted/50",
    className
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(baseClasses, "text-left")}>
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
