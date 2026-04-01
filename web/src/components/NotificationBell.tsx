"use client";

import { useEffect, useState, useCallback, memo } from "react";
import { createClient } from "@/lib/supabase";
import { Bell, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { approveDeleteRequest, denyDeleteRequest } from "@/lib/delete-requests";
import { approveDocumentAccessRequest, denyDocumentAccessRequest } from "@/lib/document-access";
import { approvePageAccessRequest, denyPageAccessRequest } from "@/lib/page-access";
import { useUser } from "@/lib/contexts/UserContext";

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata?: {
    type?: string;
    delete_request_id?: string;
    document_access_request_id?: string;
    page_access_request_id?: string;
  } | null;
}

function NotificationBellInner() {
  const { profile, isOwner, isHoussam } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, link, is_read, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data as Notification[]) ?? [];
    setNotifications(list);
    setUnreadCount(list.filter((n) => !n.is_read).length);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        fetchNotifications
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function handleNotificationClick(n: Notification) {
    const hasActions =
      n.metadata?.type === "delete_request" ||
      n.metadata?.type === "document_access_request" ||
      n.metadata?.type === "page_access_request";
    if (hasActions) return;
    markAsRead(n.id);
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
      markAsRead(n.id);
      fetchNotifications();
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
      markAsRead(n.id);
      fetchNotifications();
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
      markAsRead(n.id);
      fetchNotifications();
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
      markAsRead(n.id);
      fetchNotifications();
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
      markAsRead(n.id);
      fetchNotifications();
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
      markAsRead(n.id);
      fetchNotifications();
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
      <DropdownMenuContent align="end" className="w-80 max-h-[400px] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={markAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            notifications.map((n) => {
              const isDeleteRequest = n.metadata?.type === "delete_request" && n.metadata?.delete_request_id;
              const isDocAccess = n.metadata?.type === "document_access_request" && n.metadata?.document_access_request_id;
              const isPageAccess = n.metadata?.type === "page_access_request" && n.metadata?.page_access_request_id;
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
                    "border-b px-4 py-3 transition-colors hover:bg-muted/50",
                    !hasActions && "cursor-pointer",
                    !n.is_read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {n.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                  {isDeleteRequest && isOwner && (
                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="default" className="h-7 text-xs"
                        onClick={(e) => handleApproveDelete(n, e)} disabled={isActioning}>
                        <Check className="mr-1 size-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={(e) => handleDenyDelete(n, e)} disabled={isActioning}>
                        <X className="mr-1 size-3" /> Deny
                      </Button>
                    </div>
                  )}
                  {isDocAccess && isHoussam && (
                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="default" className="h-7 text-xs"
                        onClick={(e) => handleApproveDocumentAccess(n, e)} disabled={isActioning}>
                        <Check className="mr-1 size-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={(e) => handleDenyDocumentAccess(n, e)} disabled={isActioning}>
                        <X className="mr-1 size-3" /> Deny
                      </Button>
                    </div>
                  )}
                  {isPageAccess && isHoussam && (
                    <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="default" className="h-7 text-xs"
                        onClick={(e) => handleApprovePageAccess(n, e)} disabled={isActioning}>
                        <Check className="mr-1 size-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={(e) => handleDenyPageAccess(n, e)} disabled={isActioning}>
                        <X className="mr-1 size-3" /> Deny
                      </Button>
                    </div>
                  )}
                  {n.link && !hasActions && (
                    <Link href={n.link} className="text-xs text-primary hover:underline mt-1 inline-block"
                      onClick={(e) => e.stopPropagation()}>View →</Link>
                  )}
                  {n.link && hasActions && !canAct && (
                    <Link href={n.link} className="text-xs text-primary hover:underline mt-1 inline-block"
                      onClick={(e) => e.stopPropagation()}>View →</Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const NotificationBell = memo(NotificationBellInner);
