"use client";

/**
 * Dialog showing Garage visits or Maintenance events.
 * Each date is clickable to open the full day detail.
 */

import type { CarEvent } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface VisitsMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "garage" | "maintenance";
  events: CarEvent[];
  eventLabels: Record<string, string>;
  formatEventDisplay?: (ev: CarEvent) => string;
  onOpenDay: (dateStr: string) => void;
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function VisitsMaintenanceDialog({
  open,
  onOpenChange,
  mode,
  events,
  eventLabels,
  formatEventDisplay,
  onOpenDay,
}: VisitsMaintenanceDialogProps) {
  const eventsByDate = events.reduce<Record<string, CarEvent[]>>((acc, ev) => {
    const d = new Date(ev.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});
  const sortedDates = Object.keys(eventsByDate).sort((a, b) =>
    b.localeCompare(a)
  );

  const title = mode === "garage" ? "Garage visits" : "Maintenance";
  const emptyMsg =
    mode === "garage"
      ? "No garage visits recorded yet."
      : "No maintenance events recorded yet.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          Click a date to see full details and attach files for that day.
        </p>
        {sortedDates.length === 0 ? (
          <p className="text-muted-foreground py-4">{emptyMsg}</p>
        ) : (
          <div className="space-y-2">
            {sortedDates.map((dateStr) => {
              const dayEvents = eventsByDate[dateStr];
              return (
                <button
                  key={dateStr}
                  type="button"
                  className="flex w-full flex-col gap-2 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50 hover:border-primary/50"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenDay(dateStr);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {formatDateLabel(dateStr)}
                    </span>
                    <span className="text-muted-foreground text-sm">→</span>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {dayEvents.map((ev) => (
                      <li key={ev.id} className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {eventLabels[ev.event_type] ?? ev.event_type}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatEventDisplay
                            ? formatEventDisplay(ev)
                            : ev.from_value && ev.to_value
                              ? `${ev.from_value} → ${ev.to_value}`
                              : ev.to_value ?? ev.from_value ?? ""}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
