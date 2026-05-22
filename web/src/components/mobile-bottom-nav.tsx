"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export type BottomNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

// Tab cells are narrow — shorten the longer nav labels so they fit on one line.
const SHORT_LABELS: Record<string, string> = {
  "Assistant Dashboard": "Home",
  "Owner overview": "Overview",
  "Request Center": "Requests",
  "Sales Orders": "Sales",
  "Company Costs": "Costs",
  "Recall Center": "Recalls",
  "Cash register": "Cash",
  "Data Health": "Health",
  "Ordered Cars": "Ordered",
  "Test Drive": "Test",
};

function shortLabel(label: string): string {
  return SHORT_LABELS[label] ?? label.split(" ")[0]!;
}

/**
 * Phone-only bottom tab bar. Shows the first few role-visible destinations
 * plus a "More" tab that opens the full navigation drawer. Hidden from `md`
 * up, where the sidebar takes over.
 */
export function MobileBottomNav({
  items,
  pathname,
  onMore,
}: {
  items: BottomNavItem[];
  pathname: string;
  onMore: () => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,0,0,0.06)] backdrop-blur-lg md:hidden"
    >
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors active:bg-accent/60",
              active ? "text-primary" : "text-muted-foreground"
            )}
          >
            {active && (
              <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />
            )}
            <Icon className="size-5 shrink-0" />
            <span className="max-w-[4.75rem] truncate">{shortLabel(item.label)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-label="More"
        className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors active:bg-accent/60"
      >
        <Menu className="size-5 shrink-0" />
        <span>More</span>
      </button>
    </nav>
  );
}
