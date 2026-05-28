"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatError } from "@/lib/error-messages";
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  Check,
  Clock,
  Inbox,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Severity = "info" | "warning" | "urgent" | "critical";
type Category =
  | "mention"
  | "assignment"
  | "approval"
  | "reply"
  | "status_change"
  | "alert"
  | "customer"
  | "critical";

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  read_at: string | null;
  dismissed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  category: Category | null;
  severity: Severity | null;
  event_type: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
}

const SEVERITY_BAR: Record<Severity, string> = {
  info: "border-l-sky-500",
  warning: "border-l-amber-500",
  urgent: "border-l-orange-500",
  critical: "border-l-red-600",
};

const SEVERITY_DOT: Record<Severity, string> = {
  info: "bg-sky-500",
  warning: "bg-amber-500",
  urgent: "bg-orange-500",
  critical: "bg-red-600",
};

const SEVERITY_ICON: Record<Severity, typeof Bell> = {
  info: Bell,
  warning: AlertTriangle,
  urgent: AlertTriangle,
  critical: AlertOctagon,
};

type TabId = "all" | "unread" | Category;
const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "critical", label: "Critical" },
  { id: "approval", label: "Approvals" },
  { id: "assignment", label: "Assignments" },
  { id: "alert", label: "Alerts" },
  { id: "mention", label: "Mentions" },
  { id: "reply", label: "Replies" },
  { id: "status_change", label: "Status" },
  { id: "customer", label: "Customer" },
];

export default function NotificationsPage() {
  const { profile } = useUser();
  const supabase = createClient();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>("unread");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, title, message, link, is_read, read_at, dismissed_at, snoozed_until, created_at, category, severity, event_type, related_entity_type, related_entity_id"
      )
      .eq("user_id", profile.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      toast.error(formatError(error));
    } else {
      setItems((data as Notification[]) ?? []);
    }
    setLoading(false);
  }, [profile?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the latest `load` in a ref so the realtime effect can call it without
  // listing `load` as a dependency. Otherwise — even with the singleton
  // Supabase client — any future change to `load`'s deps would tear down and
  // re-subscribe the channel mid-session.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Realtime keeps inbox fresh
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`notif-inbox:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          void loadRef.current();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, supabase]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = items.filter(
      (n) => !n.snoozed_until || new Date(n.snoozed_until).getTime() <= now
    );
    if (tab === "unread") {
      list = list.filter((n) => !n.is_read);
    } else if (tab !== "all") {
      list = list.filter((n) => n.category === tab);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.message.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, tab, query]);

  const unreadCount = useMemo(() => {
    const now = Date.now();
    return items.filter(
      (n) =>
        !n.is_read &&
        (!n.snoozed_until || new Date(n.snoozed_until).getTime() <= now)
    ).length;
  }, [items]);

  const allSelected =
    filtered.length > 0 && filtered.every((n) => selectedIds.has(n.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((n) => n.id)));
    }
  }

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setItems((prev) =>
      prev.map((n) =>
        ids.includes(n.id) ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      )
    );
    setSelectedIds(new Set());
  }

  async function markAllRead() {
    setBusy(true);
    const { error } = await supabase.rpc("mark_all_notifications_read");
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    const nowIso = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? nowIso }))
    );
  }

  async function dismissBulk(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const succeeded = new Set<string>();
    let failures = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("dismiss_notification", { p_id: id });
      if (error) failures++;
      else succeeded.add(id);
    }
    setBusy(false);
    if (failures > 0) toast.error(`${failures} dismiss(es) failed`);
    // Only remove notifications that were actually dismissed — a failed one
    // must stay visible, not silently vanish until the next reload.
    setItems((prev) => prev.filter((n) => !succeeded.has(n.id)));
    // Keep any that failed selected so the user can retry them.
    setSelectedIds(new Set(ids.filter((id) => !succeeded.has(id))));
  }

  async function snooze(id: string, getUntil: () => Date) {
    const until = getUntil().toISOString();
    setBusy(true);
    const { error } = await supabase.rpc("snooze_notification", {
      p_id: id,
      p_until: until,
    });
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setItems((prev) => prev.filter((n) => n.id !== id));
    toast.success("Snoozed");
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-muted-foreground text-sm">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            data-tour-id="notifications-mark-all-read"
            variant="outline"
            size="sm"
            onClick={() => void markAllRead()}
            disabled={busy || unreadCount === 0}
          >
            Mark all read
          </Button>
          <Link
            data-tour-id="notifications-preferences-link"
            href="/settings/notifications"
            className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
          >
            Preferences →
          </Link>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
        <TabsList className="flex h-auto flex-wrap" data-tour-id="notifications-tabs">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs">
              {t.label}
              {t.id === "unread" && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2 h-4 px-1.5 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          data-tour-id="notifications-search-input"
          placeholder="Search notifications…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      {selectedIds.size > 0 && (
        <div
          className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-md border p-2"
          data-tour-id="notifications-bulk-actions"
        >
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            data-tour-id="notifications-bulk-mark-read"
            variant="outline"
            size="sm"
            onClick={() => void markRead(Array.from(selectedIds))}
            disabled={busy}
          >
            <Check className="mr-1.5 size-3.5" /> Mark read
          </Button>
          <Button
            data-tour-id="notifications-bulk-dismiss"
            variant="outline"
            size="sm"
            onClick={() => void dismissBulk(Array.from(selectedIds))}
            disabled={busy}
          >
            <Trash2 className="mr-1.5 size-3.5" /> Dismiss
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Inbox className="size-8 opacity-40" />
          <p>
            {tab === "unread"
              ? "No unread notifications."
              : "Nothing in this bucket."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label
            className="text-muted-foreground flex cursor-pointer items-center gap-2 px-1 text-xs"
            data-tour-id="notifications-select-all"
          >
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="size-3.5"
            />
            Select all visible
          </label>
          <ul className="divide-border bg-card divide-y rounded-md border" data-tour-id="notifications-list">
            {filtered.map((n) => {
              const sev: Severity = (n.severity ?? "info") as Severity;
              const Icon = SEVERITY_ICON[sev];
              const isSel = selectedIds.has(n.id);
              return (
                <li
                  key={n.id}
                  className={cn(
                    "border-l-4 px-4 py-3 transition-colors",
                    SEVERITY_BAR[sev],
                    !n.is_read && "bg-primary/5",
                    isSel && "ring-primary/40 ring-2"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelect(n.id)}
                      className="mt-1 size-3.5"
                      aria-label="Select notification"
                    />
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        sev === "info" && "text-sky-500",
                        sev === "warning" && "text-amber-500",
                        sev === "urgent" && "text-orange-500",
                        sev === "critical" && "text-red-600"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className={cn("text-sm", !n.is_read && "font-semibold")}>
                          {n.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="h-5 px-1.5 text-[10px] uppercase"
                        >
                          {n.category ?? "notification"}
                        </Badge>
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {n.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {n.link && (
                          <Link
                            href={n.link}
                            className="text-primary text-xs hover:underline"
                          >
                            Open →
                          </Link>
                        )}
                        {!n.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => void markRead([n.id])}
                            disabled={busy}
                          >
                            <Check className="mr-1 size-3" /> Mark read
                          </Button>
                        )}
                        {sev !== "critical" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs">
                                <Clock className="mr-1 size-3" /> Snooze
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                              {[
                                {
                                  label: "1 hour",
                                  getUntil: () => new Date(Date.now() + 60 * 60 * 1000),
                                },
                                { label: "Tomorrow 8am", getUntil: tomorrowMorning },
                                {
                                  label: "Next week",
                                  getUntil: () =>
                                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                },
                              ].map((opt) => (
                                <DropdownMenuItem
                                  key={opt.label}
                                  onSelect={() => void snooze(n.id, opt.getUntil)}
                                  className="text-xs"
                                >
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive h-7 text-xs"
                          onClick={() => void dismissBulk([n.id])}
                          disabled={busy}
                        >
                          <X className="mr-1 size-3" /> Dismiss
                        </Button>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        SEVERITY_DOT[sev]
                      )}
                      title={sev}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Always resolves to 08:00 on the next calendar day, computed at click time
// so it cannot drift earlier than 8am the way an elapsed-duration would.
function tomorrowMorning(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}
