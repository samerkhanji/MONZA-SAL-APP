"use client";

import { useEffect, useState, useCallback, memo, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import {
  Bell,
  Check,
  X,
  AlertTriangle,
  AlertOctagon,
  Info,
  Clock,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { approveDeleteRequest, denyDeleteRequest } from "@/lib/delete-requests";
import {
  approveDocumentAccessRequest,
  denyDocumentAccessRequest,
} from "@/lib/document-access";
import {
  approvePageAccessRequest,
  denyPageAccessRequest,
} from "@/lib/page-access";
import { useUser } from "@/lib/contexts/UserContext";
import { formatError } from "@/lib/error-messages";

type Severity = "info" | "warning" | "urgent" | "critical";

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
  category: string | null;
  severity: Severity | null;
  event_type: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata?: {
    type?: string;
    delete_request_id?: string;
    document_access_request_id?: string;
    page_access_request_id?: string;
  } | null;
}

const SEVERITY_STYLES: Record<Severity, { dot: string; bar: string; toastClass: string; icon: typeof Info }> = {
  info:     { dot: "bg-sky-500",    bar: "border-l-sky-500",    toastClass: "",        icon: Info },
  warning:  { dot: "bg-amber-500",  bar: "border-l-amber-500",  toastClass: "",        icon: AlertTriangle },
  urgent:   { dot: "bg-orange-500", bar: "border-l-orange-500", toastClass: "",        icon: AlertTriangle },
  critical: { dot: "bg-red-600",    bar: "border-l-red-600",    toastClass: "",        icon: AlertOctagon },
};

function severityOf(n: Notification): Severity {
  return (n.severity ?? "info") as Severity;
}

function NotificationBellInner() {
  const { profile, isOwner, isHoussam } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const supabase = createClient();
  const initialFetchDone = useRef(false);

  const fetchNotifications = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, title, message, link, is_read, read_at, dismissed_at, snoozed_until, created_at, category, severity, event_type, related_entity_type, related_entity_id, metadata"
      )
      .eq("user_id", profile.id)
      .is("dismissed_at", null)
      .or("snoozed_until.is.null,snoozed_until.lte." + new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(15);
    const list = (data as Notification[]) ?? [];
    setNotifications(list);
    setUnreadCount(list.filter((n) => !n.is_read).length);
    initialFetchDone.current = true;
  }, [profile?.id, supabase]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: subscribe filtered by user_id. New INSERTs trigger a toast.
  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const row = payload.new as Notification;
          // Add to local state (top of list)
          setNotifications((prev) => [row, ...prev].slice(0, 15));
          setUnreadCount((c) => c + 1);
          // Skip toast on the very first load to avoid replaying old rows
          if (!initialFetchDone.current) return;
          const sev = severityOf(row);
          const baseDesc = row.message;
          const action = row.link
            ? { label: "Open", onClick: () => (window.location.href = row.link!) }
            : undefined;
          const id = `notif-${row.id}`;
          if (sev === "critical") {
            toast.error(row.title, { id, description: baseDesc, action, duration: Infinity });
          } else if (sev === "urgent") {
            toast.warning(row.title, { id, description: baseDesc, action, duration: 12000 });
          } else if (sev === "warning") {
            toast.warning(row.title, { id, description: baseDesc, action, duration: 8000 });
          } else {
            toast(row.title, { id, description: baseDesc, action, duration: 6000 });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, supabase]);

  async function markAsRead(id: string) {
    const { error } = await supabase.rpc("mark_notifications_read", { p_ids: [id] });
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllAsRead() {
    const { error } = await supabase.rpc("mark_all_notifications_read");
    if (error) {
      toast.error(formatError(error));
      return;
    }
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? nowIso })));
    setUnreadCount(0);
  }

  async function snoozeFor(id: string, ms: number) {
    const until = new Date(Date.now() + ms).toISOString();
    const { error } = await supabase.rpc("snooze_notification", { p_id: id, p_until: until });
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => {
      const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
      return wasUnread ? Math.max(0, c - 1) : c;
    });
    toast.success("Snoozed");
  }

  async function dismiss(id: string) {
    const { error } = await supabase.rpc("dismiss_notification", { p_id: id });
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) => {
      const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
      return wasUnread ? Math.max(0, c - 1) : c;
    });
  }

  function handleNotificationClick(n: Notification) {
    const hasActions =
      n.metadata?.type === "delete_request" ||
      n.metadata?.type === "document_access_request" ||
      n.metadata?.type === "page_access_request";
    if (hasActions) return;
    void markAsRead(n.id);
    setOpen(false);
  }

  async function handleApproveDelete(n: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    const reqId = n.metadata?.delete_request_id;
    if (!reqId || !profile?.id) return;
    setActioning(reqId);
    const ok = await approveDeleteRequest(reqId, profile.id);
    setActioning(null);
    if (ok) {
      void markAsRead(n.id);
      void fetchNotifications();
    }
  }
  async function handleDenyDelete(n: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    const reqId = n.metadata?.delete_request_id;
    if (!reqId || !profile?.id) return;
    setActioning(reqId);
    const ok = await denyDeleteRequest(reqId, profile.id);
    setActioning(null);
    if (ok) {
      void markAsRead(n.id);
      void fetchNotifications();
    }
  }
  async function handleApproveDocumentAccess(n: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    const reqId = n.metadata?.document_access_request_id;
    if (!reqId || !profile?.id) return;
    setActioning(`doc-${reqId}`);
    const ok = await approveDocumentAccessRequest(reqId, profile.id);
    setActioning(null);
    if (ok) {
      void markAsRead(n.id);
      void fetchNotifications();
    }
  }
  async function handleDenyDocumentAccess(n: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    const reqId = n.metadata?.document_access_request_id;
    if (!reqId || !profile?.id) return;
    setActioning(`doc-${reqId}`);
    const ok = await denyDocumentAccessRequest(reqId, profile.id);
    setActioning(null);
    if (ok) {
      void markAsRead(n.id);
      void fetchNotifications();
    }
  }
  async function handleApprovePageAccess(n: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    const reqId = n.metadata?.page_access_request_id;
    if (!reqId || !profile?.id) return;
    setActioning(`page-${reqId}`);
    const ok = await approvePageAccessRequest(reqId, profile.id);
    setActioning(null);
    if (ok) {
      void markAsRead(n.id);
      void fetchNotifications();
    }
  }
  async function handleDenyPageAccess(n: Notification, e: React.MouseEvent) {
    e.stopPropagation();
    const reqId = n.metadata?.page_access_request_id;
    if (!reqId || !profile?.id) return;
    setActioning(`page-${reqId}`);
    const ok = await denyPageAccessRequest(reqId, profile.id);
    setActioning(null);
    if (ok) {
      void markAsRead(n.id);
      void fetchNotifications();
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-tour-id="header-notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="flex max-h-[480px] w-96 flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">Notifications</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => void markAllAsRead()}
              >
                Mark all read
              </Button>
            )}
            <Link
              href="/notifications"
              className="text-primary hover:bg-muted rounded px-2 py-1 text-xs"
              onClick={() => setOpen(false)}
            >
              See all →
            </Link>
          </div>
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Inbox className="size-6 opacity-40" />
              <p className="text-sm">You&apos;re all caught up.</p>
            </div>
          ) : (
            notifications.map((n) => {
              const sev = severityOf(n);
              const styles = SEVERITY_STYLES[sev];
              const isDeleteRequest =
                n.metadata?.type === "delete_request" && n.metadata?.delete_request_id;
              const isDocAccess =
                n.metadata?.type === "document_access_request" &&
                n.metadata?.document_access_request_id;
              const isPageAccess =
                n.metadata?.type === "page_access_request" &&
                n.metadata?.page_access_request_id;
              const hasActions = isDeleteRequest || isDocAccess || isPageAccess;
              const canAct =
                (isDeleteRequest && isOwner) ||
                (isDocAccess && isHoussam) ||
                (isPageAccess && isHoussam);
              const isActioning =
                actioning === n.metadata?.delete_request_id ||
                actioning === `doc-${n.metadata?.document_access_request_id}` ||
                actioning === `page-${n.metadata?.page_access_request_id}`;

              return (
                <div
                  key={n.id}
                  className={cn(
                    "group border-b border-l-4 transition-colors hover:bg-muted/50",
                    styles.bar,
                    !hasActions && "cursor-pointer",
                    !n.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {sev !== "critical" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="h-6 w-6 text-muted-foreground"
                                aria-label="Snooze"
                                onClick={(e) => e.stopPropagation()}
                                title="Snooze"
                              >
                                <Clock className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {[
                                { label: "1 hour", ms: 60 * 60 * 1000 },
                                { label: "Tomorrow 8am", ms: msUntilTomorrowMorning() },
                                { label: "Next week", ms: 7 * 24 * 60 * 60 * 1000 },
                              ].map((opt) => (
                                <DropdownMenuItem
                                  key={opt.label}
                                  onSelect={() => void snoozeFor(n.id, opt.ms)}
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
                          size="icon-xs"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          aria-label="Dismiss"
                          title="Dismiss"
                          onClick={(e) => {
                            e.stopPropagation();
                            void dismiss(n.id);
                          }}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                      {n.message}
                    </p>
                    <div className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                      <span className={cn("size-1.5 rounded-full", styles.dot)} />
                      <span className="uppercase">{sev}</span>
                      <span>·</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    {isDeleteRequest && isOwner && (
                      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="default" className="h-7 text-xs"
                          onClick={(e) => handleApproveDelete(n, e)} disabled={!!isActioning}>
                          <Check className="mr-1 size-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={(e) => handleDenyDelete(n, e)} disabled={!!isActioning}>
                          <X className="mr-1 size-3" /> Deny
                        </Button>
                      </div>
                    )}
                    {isDocAccess && isHoussam && (
                      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="default" className="h-7 text-xs"
                          onClick={(e) => handleApproveDocumentAccess(n, e)} disabled={!!isActioning}>
                          <Check className="mr-1 size-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={(e) => handleDenyDocumentAccess(n, e)} disabled={!!isActioning}>
                          <X className="mr-1 size-3" /> Deny
                        </Button>
                      </div>
                    )}
                    {isPageAccess && isHoussam && (
                      <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="default" className="h-7 text-xs"
                          onClick={(e) => handleApprovePageAccess(n, e)} disabled={!!isActioning}>
                          <Check className="mr-1 size-3" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={(e) => handleDenyPageAccess(n, e)} disabled={!!isActioning}>
                          <X className="mr-1 size-3" /> Deny
                        </Button>
                      </div>
                    )}
                    {n.link && (!hasActions || !canAct) && (
                      <Link
                        href={n.link}
                        className="text-primary mt-1 inline-block text-xs hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function msUntilTomorrowMorning(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return Math.max(60 * 60 * 1000, d.getTime() - Date.now());
}

export const NotificationBell = memo(NotificationBellInner);
