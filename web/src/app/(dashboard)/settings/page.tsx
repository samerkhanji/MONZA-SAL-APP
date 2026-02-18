"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { UserRole, UserCapability } from "@/lib/contexts/UserContext";
import { USER_ROLE_LABELS } from "@/lib/constants/user";
import {
  Users,
  Building2,
  Settings,
  FileText,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Bell,
  User,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditTeamMemberDialog } from "@/components/settings/EditTeamMemberDialog";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { cn } from "@/lib/utils";
import { REQUEST_STATUS_LABELS } from "@/lib/constants/requests";

const ALL_TABS = [
  { id: "profile", label: "Profile", icon: User, everyone: true },
  { id: "my-requests", label: "My Requests", icon: FileCheck, everyone: true },
  { id: "notifications", label: "Notifications", icon: Bell, everyone: true },
  { id: "team", label: "Team", icon: Users, everyone: false },
  { id: "company", label: "Company", icon: Building2, everyone: false },
  { id: "prefs", label: "Preferences", icon: Settings, everyone: false },
  { id: "audit", label: "Audit Log", icon: FileText, everyone: false },
  { id: "pending-requests", label: "Pending Requests", icon: Trash2, everyone: false },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  sales: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  garage_manager:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  assistant: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const CAPABILITY_LABELS: Record<string, string> = {
  garage: "Garage",
  vehicle_software: "Software",
  cashier: "Cashier",
  events_ops: "Events",
};

interface ProfileRow {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  capabilities: UserCapability[];
  is_active: boolean;
  created_at?: string;
}

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canSeeSettings, canSeeProfileSettings, canSeeMyRequests, canSeeAllRequests, profile } = useUser();
  const tabFromUrl = searchParams.get("tab") as TabId | null;
  const defaultTab: TabId = canSeeSettings ? "team" : "profile";
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl && ALL_TABS.some((t) => t.id === tabFromUrl) ? tabFromUrl : defaultTab);

  const TABS = ALL_TABS.filter((t) => t.everyone || canSeeSettings);

  useEffect(() => {
    if (tabFromUrl && ALL_TABS.some((t) => t.id === tabFromUrl)) {
      const tab = ALL_TABS.find((t) => t.id === tabFromUrl);
      if (tab && (tab.everyone || canSeeSettings)) {
        setActiveTab(tabFromUrl);
      }
    }
  }, [tabFromUrl, canSeeSettings]);

  useEffect(() => {
    const allowedIds = TABS.map((t) => t.id);
    if (!allowedIds.includes(activeTab)) {
      setActiveTab((TABS[0]?.id ?? "profile") as TabId);
    }
  }, [activeTab, canSeeSettings]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [editProfile, setEditProfile] = useState<ProfileRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Company & prefs state
  const [companyName, setCompanyName] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Audit state
  const [auditItems, setAuditItems] = useState<
    Array<{
      id: string;
      type: "car" | "part" | "customer";
      user: string;
      action: string;
      details: string;
      time: string;
      link?: string;
    }>
  >([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>("all");
  const [auditUserFilter, setAuditUserFilter] = useState<string>("all");
  const [auditDateFilter, setAuditDateFilter] = useState<string>("7");

  const [pendingItems, setPendingItems] = useState<
    Array<{
      id: string;
      type: "delete" | "request" | "document_access" | "page_access";
      typeLabel: string;
      subject?: string;
      item_type?: string;
      item_id?: string;
      item_details?: Record<string, unknown>;
      requested_by: string;
      requester_name?: string;
      created_at: string;
      link?: string;
    }>
  >([]);
  const [pendingItemsLoading, setPendingItemsLoading] = useState(false);
  const [deleteActioning, setDeleteActioning] = useState<string | null>(null);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>("");
  const [pushLoading, setPushLoading] = useState(false);

  const [myRequests, setMyRequests] = useState<
    Array<{
      id: string;
      subject: string;
      status: string;
      submitted_by: string;
      submitter_name?: string;
      created_at: string;
      resolved_at: string | null;
    }>
  >([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const supabase = createClient();

  const canAccessSettings = canSeeSettings || canSeeProfileSettings || canSeeMyRequests;

  useEffect(() => {
    if (!canAccessSettings) {
      router.replace("/dashboard");
      return;
    }
  }, [canAccessSettings, router]);

  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(error.message);
      setProfiles([]);
    } else {
      setProfiles((data as ProfileRow[]) ?? []);
    }
    setProfilesLoading(false);
  }, []);

  useEffect(() => {
    if (canSeeSettings && activeTab === "team") {
      fetchProfiles();
    }
  }, [canSeeSettings, activeTab, fetchProfiles]);

  const fetchPrefs = useCallback(async () => {
    setPrefsLoading(true);
    const { data, error } = await supabase.from("system_preferences").select("*");

    if (error) {
      toast.error(error.message);
    } else {
      const prefs = (data ?? []).reduce(
        (acc: Record<string, string>, row: { key: string; value: string }) => {
          acc[row.key] = row.value;
          return acc;
        },
        {}
      );
      setCompanyName(prefs.company_name ?? "");
      setCompanyPhone(prefs.company_phone ?? "");
      setCompanyEmail(prefs.company_email ?? "");
      setCompanyAddress(prefs.company_address ?? "");
      setCompanyWebsite(prefs.company_website ?? "");
      setDefaultCurrency(prefs.default_currency ?? "USD");
      setDefaultLanguage(prefs.default_language ?? "en");
    }
    setPrefsLoading(false);
  }, []);

  useEffect(() => {
    if (canSeeSettings && (activeTab === "company" || activeTab === "prefs")) {
      fetchPrefs();
    }
  }, [canSeeSettings, activeTab, fetchPrefs]);

  async function savePref(key: string, value: string) {
    setPrefsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("system_preferences")
      .upsert(
        {
          key,
          value,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    setPrefsSaving(false);
    if (error) {
      toast.error(`Failed to save: ${error.message}`);
    } else {
      toast.success("Settings saved");
    }
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    await Promise.all([
      savePref("company_name", companyName),
      savePref("company_phone", companyPhone),
      savePref("company_email", companyEmail),
      savePref("company_address", companyAddress),
      savePref("company_website", companyWebsite),
    ]);
  }

  async function handleSavePrefs(e: React.FormEvent) {
    e.preventDefault();
    await Promise.all([
      savePref("default_currency", defaultCurrency),
      savePref("default_language", defaultLanguage),
    ]);
  }

  async function handleToggleActive(profile: ProfileRow) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(profile.is_active ? "User deactivated" : "User activated");
      fetchProfiles();
    }
  }

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    const cutoff =
      auditDateFilter === "1"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : auditDateFilter === "30"
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          : auditDateFilter === "all"
            ? ""
            : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [carRes, partRes, noteRes] = await Promise.all([
      supabase
        .from("car_events")
        .select("*, profiles:created_by(full_name), cars:car_id(vin, brand, model)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("part_movements")
        .select("*, profiles:created_by(full_name), parts:part_id(part_name, oe_number), cars:car_id(vin, brand, model)")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("customer_notes")
        .select("*, profiles:created_by(full_name), customers:customer_id(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const items: Array<{
      id: string;
      type: "car" | "part" | "customer";
      user: string;
      action: string;
      details: string;
      time: string;
      link?: string;
    }> = [];

    const carMessages: Record<string, (e: { cars?: { brand?: string; model?: string }; from_value?: string; to_value?: string }) => string> = {
      created: (e) => `Added car ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""}`,
      moved: (e) => `Moved ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""} from ${e.from_value ?? "?"} to ${e.to_value ?? "?"}`,
      status_changed: (e) => `Changed ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""} status: ${e.from_value ?? "?"} → ${e.to_value ?? "?"}`,
      battery_updated: (e) => `Updated battery on ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""}`,
      pdi_updated: (e) => `Updated PDI on ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""}`,
      details_updated: (e) => `Edited ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""} details`,
      note_added: (e) => `Added note on ${e.cars?.brand ?? ""} ${e.cars?.model ?? ""}`,
    };

    (carRes.data ?? []).forEach((ev: { id: string; car_id: string; event_type: string; created_at: string; profiles?: { full_name?: string } | null; cars?: { vin?: string; brand?: string; model?: string }; from_value?: string; to_value?: string }) => {
      if (cutoff && ev.created_at < cutoff) return;
      const user = (ev.profiles as { full_name?: string })?.full_name ?? "System";
      const msg = carMessages[ev.event_type]?.(ev) ?? ev.event_type;
      items.push({
        id: `car-${ev.id}`,
        type: "car",
        user,
        action: msg,
        details: ev.cars?.vin ? `VIN ...${String(ev.cars.vin).slice(-4)}` : "",
        time: ev.created_at,
        link: `/cars/${ev.car_id}`,
      });
    });

    const movementMessages: Record<string, (m: { quantity?: number; parts?: { part_name?: string }; cars?: { brand?: string; model?: string } }) => string> = {
      stock_in: (m) => `Stocked in ${m.quantity ?? 0}× ${(m.parts as { part_name?: string })?.part_name ?? ""}`,
      stock_out: (m) => `Used ${m.quantity ?? 0}× ${(m.parts as { part_name?: string })?.part_name ?? ""}${(m.cars as { brand?: string; model?: string }) ? ` on ${(m.cars as { brand?: string }).brand ?? ""} ${(m.cars as { model?: string }).model ?? ""}` : ""}`,
      adjustment: (m) => `Adjusted ${(m.parts as { part_name?: string })?.part_name ?? ""} stock`,
      return: (m) => `Returned ${m.quantity ?? 0}× ${(m.parts as { part_name?: string })?.part_name ?? ""}`,
    };

    (partRes.data ?? []).forEach((mov: { id: string; part_id: string; created_at: string; movement_type: string; quantity?: number; profiles?: { full_name?: string } | null; parts?: { part_name?: string }; cars?: { brand?: string; model?: string } }) => {
      if (cutoff && mov.created_at < cutoff) return;
      const user = (mov.profiles as { full_name?: string })?.full_name ?? "System";
      const msg = movementMessages[mov.movement_type]?.(mov) ?? mov.movement_type;
      items.push({
        id: `part-${mov.id}`,
        type: "part",
        user,
        action: msg,
        details: "",
        time: mov.created_at,
        link: "/garage/inventory",
      });
    });

    (noteRes.data ?? []).forEach((n: { id: string; customer_id: string; note_type: string; created_at: string; profiles?: { full_name?: string } | null; customers?: { first_name?: string; last_name?: string } }) => {
      if (cutoff && n.created_at < cutoff) return;
      const user = (n.profiles as { full_name?: string })?.full_name ?? "System";
      const cust = n.customers as { first_name?: string; last_name?: string };
      items.push({
        id: `note-${n.id}`,
        type: "customer",
        user,
        action: `Added ${n.note_type} note on ${cust?.first_name ?? ""} ${cust?.last_name ?? ""}`.trim(),
        details: "",
        time: n.created_at,
        link: `/customers/${n.customer_id}`,
      });
    });

    items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setAuditItems(items.slice(0, 100));
    setAuditLoading(false);
  }, [auditDateFilter]);

  useEffect(() => {
    if (canSeeSettings && activeTab === "audit") {
      fetchAudit();
    }
  }, [canSeeSettings, activeTab, fetchAudit, auditDateFilter]);

  const filteredAudit = auditItems.filter((item) => {
    if (auditTypeFilter !== "all" && item.type !== auditTypeFilter) return false;
    if (auditUserFilter !== "all" && item.user !== auditUserFilter) return false;
    return true;
  });

  const auditUsers = [...new Set(auditItems.map((i) => i.user))].sort();

  const fetchPendingItems = useCallback(async () => {
    setPendingItemsLoading(true);
    type PendingItem = {
      id: string;
      type: "delete" | "request" | "document_access" | "page_access";
      typeLabel: string;
      subject?: string;
      item_type?: string;
      item_id?: string;
      item_details?: Record<string, unknown>;
      requested_by: string;
      requester_name?: string;
      created_at: string;
      link?: string;
    };
    const items: PendingItem[] = [];

    const [delRes, reqRes, docRes, pageRes] = await Promise.all([
      supabase
        .from("delete_requests")
        .select("id, item_type, item_id, item_details, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("requests")
        .select("id, subject, submitted_by, created_at")
        .eq("status", "submitted")
        .in("send_to", ["houssam", "kareem"])
        .order("created_at", { ascending: false }),
      supabase
        .from("document_access_requests")
        .select("id, search_query, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("page_access_requests")
        .select("id, page_name, requested_by, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    const userIds = new Set<string>();
    (delRes.data ?? []).forEach((r: { requested_by: string }) => userIds.add(r.requested_by));
    (reqRes.data ?? []).forEach((r: { submitted_by: string }) => userIds.add(r.submitted_by));
    (docRes.data ?? []).forEach((r: { requested_by: string }) => userIds.add(r.requested_by));
    (pageRes.data ?? []).forEach((r: { requested_by: string }) => userIds.add(r.requested_by));

    let namesMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      namesMap = Object.fromEntries(
        (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
          p.id,
          p.full_name ?? "Unknown",
        ])
      );
    }

    (delRes.data ?? []).forEach((r: { id: string; item_type: string; item_id: string; item_details: Record<string, unknown>; requested_by: string; created_at: string }) => {
      const details = r.item_details ?? {};
      const label = r.item_type === "car"
        ? `${details.brand ?? ""} ${details.model ?? ""} (${details.vin ?? ""})`
        : `${details.part_name ?? ""} (OE: ${details.oe_number ?? "—"})`;
      items.push({
        id: `del-${r.id}`,
        type: "delete",
        typeLabel: "Delete",
        subject: label,
        item_type: r.item_type,
        item_id: r.item_id,
        item_details: r.item_details,
        requested_by: r.requested_by,
        requester_name: namesMap[r.requested_by] ?? "Unknown",
        created_at: r.created_at,
        link: "/settings?tab=pending-requests",
      });
    });

    (reqRes.data ?? []).forEach((r: { id: string; subject: string; submitted_by: string; created_at: string }) => {
      items.push({
        id: `req-${r.id}`,
        type: "request",
        typeLabel: "Request",
        subject: r.subject,
        requested_by: r.submitted_by,
        requester_name: namesMap[r.submitted_by] ?? "Unknown",
        created_at: r.created_at,
        link: `/requests?detail=${r.id}`,
      });
    });

    (docRes.data ?? []).forEach((r: { id: string; search_query: string; requested_by: string; created_at: string }) => {
      items.push({
        id: `doc-${r.id}`,
        type: "document_access",
        typeLabel: "Document Access",
        subject: r.search_query,
        requested_by: r.requested_by,
        requester_name: namesMap[r.requested_by] ?? "Unknown",
        created_at: r.created_at,
        link: "/settings?tab=pending-requests",
      });
    });

    (pageRes.data ?? []).forEach((r: { id: string; page_name: string; requested_by: string; created_at: string }) => {
      items.push({
        id: `page-${r.id}`,
        type: "page_access",
        typeLabel: "Page Access",
        subject: r.page_name,
        requested_by: r.requested_by,
        requester_name: namesMap[r.requested_by] ?? "Unknown",
        created_at: r.created_at,
        link: "/settings?tab=pending-requests",
      });
    });

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPendingItems(items);
    setPendingItemsLoading(false);
  }, []);

  useEffect(() => {
    if (canSeeSettings && activeTab === "pending-requests") {
      fetchPendingItems();
    }
  }, [canSeeSettings, activeTab, fetchPendingItems]);

  const fetchMyRequests = useCallback(async () => {
    if (!profile?.id) return;
    setMyRequestsLoading(true);
    let query = supabase
      .from("requests")
      .select("id, subject, status, submitted_by, created_at, resolved_at")
      .in("status", ["approved", "rejected"])
      .order("created_at", { ascending: false });

    if (!canSeeAllRequests) {
      query = query.eq("send_to_user_id", profile.id);
    }

    const { data, error } = await query;

    if (error) {
      toast.error(error.message);
      setMyRequests([]);
    } else {
      const list = (data ?? []) as Array<{
        id: string;
        subject: string;
        status: string;
        submitted_by: string;
        created_at: string;
        resolved_at: string | null;
      }>;
      const userIds = [...new Set(list.map((r) => r.submitted_by))];
      let namesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        namesMap = Object.fromEntries(
          (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
            p.id,
            p.full_name ?? "Unknown",
          ])
        );
      }
      setMyRequests(
        list.map((r) => ({
          ...r,
          submitter_name: namesMap[r.submitted_by] ?? "Unknown",
        }))
      );
    }
    setMyRequestsLoading(false);
  }, [profile?.id, canSeeAllRequests]);

  useEffect(() => {
    if (activeTab === "my-requests") {
      fetchMyRequests();
    }
  }, [activeTab, fetchMyRequests]);

  async function handleApproveDelete(reqId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDeleteActioning(reqId);
    const { approveDeleteRequest } = await import("@/lib/delete-requests");
    await approveDeleteRequest(reqId, user.id);
    setDeleteActioning(null);
    fetchPendingItems();
  }

  async function handleDenyDelete(reqId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setDeleteActioning(reqId);
    const { denyDeleteRequest } = await import("@/lib/delete-requests");
    await denyDeleteRequest(reqId, user.id);
    setDeleteActioning(null);
    fetchPendingItems();
  }

  const refreshPushStatus = useCallback(async () => {
    const { getPushStatus } = await import("@/lib/push-subscription");
    const status = await getPushStatus();
    setPushStatus(status);
    if (status === "denied") {
      setPushEnabled(false);
    } else if (status === "enabled" || status === "unsubscribed") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);
        setPushEnabled((data?.length ?? 0) > 0);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === "notifications") {
      refreshPushStatus();
    }
  }, [activeTab, refreshPushStatus]);

  async function handleTogglePush(enabled: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPushLoading(true);
    const {
      registerPushSubscription,
      unregisterPushSubscription,
    } = await import("@/lib/push-subscription");
    if (enabled) {
      const result = await registerPushSubscription(user.id);
      if (result.ok) {
        setPushEnabled(true);
        toast.success("Push notifications enabled");
      } else {
        const msg = result.message ?? (result.reason === "permission_denied"
          ? "Notifications blocked. Enable them in your browser settings."
          : "Failed to enable push notifications");
        toast.error(msg);
      }
    } else {
      await unregisterPushSubscription(user.id);
      setPushEnabled(false);
      toast.success("Push notifications disabled");
    }
    setPushLoading(false);
    refreshPushStatus();
  }

  if (!canAccessSettings) return null;

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:flex-row">
      {/* Tabs sidebar */}
      <nav className="flex shrink-0 flex-row gap-2 border-b pb-4 lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {activeTab === "profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your account and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="font-medium">{profile?.full_name ?? "User"}</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.phone ?? "No phone"}{" "}
                  · {USER_ROLE_LABELS[profile?.role ?? "assistant"]}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">
                    Change your password to keep your account secure
                  </p>
                </div>
                <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "my-requests" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {canSeeAllRequests ? "All Requests" : "My Requests"}
              </CardTitle>
              <CardDescription>
                {canSeeAllRequests
                  ? "All requests (approved or rejected)"
                  : "Requests sent to you that have been approved or rejected"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myRequestsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : myRequests.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No resolved requests found
                </p>
              ) : (
                <div className="space-y-1 rounded-lg border">
                  {myRequests.map((r) => (
                    <Link
                      key={r.id}
                      href={`/requests?detail=${r.id}`}
                      className="flex items-center gap-4 border-b p-3 text-left transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <span className="shrink-0 text-sm text-muted-foreground w-16">
                        {timeAgo(r.resolved_at ?? r.created_at)}
                      </span>
                      <span className="shrink-0 font-medium min-w-[80px]">
                        {REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{r.subject}</span>
                      <span className="shrink-0 text-muted-foreground text-sm">
                        from {r.submitter_name}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {canSeeAllRequests && (
                <div className="mt-4">
                  <Link href="/requests">
                    <Button variant="outline">Open Request Center</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "team" && (
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your team&apos;s access and roles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                To add new team members, create their account in the Supabase
                Dashboard first, then edit their profile here.
              </div>
              {profilesLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Name</th>
                        <th className="px-4 py-3 text-left font-medium">Role</th>
                        <th className="px-4 py-3 text-left font-medium">Capabilities</th>
                        <th className="px-4 py-3 text-left font-medium">Phone</th>
                        <th className="px-4 py-3 text-left font-medium">Active</th>
                        <th className="px-4 py-3 text-left font-medium">Joined</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="px-4 py-3 font-medium">{p.full_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "rounded px-2 py-0.5 text-xs font-medium",
                                ROLE_COLORS[p.role] ?? "bg-muted"
                              )}
                            >
                              {USER_ROLE_LABELS[p.role]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(p.capabilities ?? []).map((c) => (
                                <span
                                  key={c}
                                  className="rounded bg-muted px-2 py-0.5 text-xs"
                                >
                                  {CAPABILITY_LABELS[c] ?? c}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.phone ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-block size-2 rounded-full",
                                p.is_active ? "bg-green-500" : "bg-gray-400"
                              )}
                              aria-label={p.is_active ? "Active" : "Inactive"}
                            />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.created_at
                              ? new Date(p.created_at).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditProfile(p);
                                  setEditOpen(true);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleActive(p)}
                                title={p.is_active ? "Deactivate" : "Activate"}
                              >
                                {p.is_active ? (
                                  <PowerOff className="size-4 text-muted-foreground" />
                                ) : (
                                  <Power className="size-4 text-green-600" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "company" && (
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Monza S.A.L. details</CardDescription>
            </CardHeader>
            <CardContent>
              {prefsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <form onSubmit={handleSaveCompany} className="space-y-4">
                  <div>
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company-name"
                      name="company-name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Monza S.A.L."
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_phone">Phone</Label>
                    <Input
                      id="company-phone"
                      name="company-phone"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      placeholder="+961 ..."
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_email">Email</Label>
                    <Input
                      id="company-email"
                      name="company-email"
                      type="email"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      placeholder="info@monza.com"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_address">Address</Label>
                    <Input
                      id="company-address"
                      name="company-address"
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_website">Website</Label>
                    <Input
                      id="company-website"
                      name="company-website"
                      value={companyWebsite}
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      placeholder="https://..."
                      className="mt-2"
                    />
                  </div>
                  <Button type="submit" disabled={prefsSaving}>
                    {prefsSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "prefs" && (
          <Card>
            <CardHeader>
              <CardTitle>System Preferences</CardTitle>
              <CardDescription>Default settings for the system</CardDescription>
            </CardHeader>
            <CardContent>
              {prefsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <form onSubmit={handleSavePrefs} className="space-y-4">
                  <div>
                    <Label>Default Currency</Label>
                    <Select
                      value={defaultCurrency}
                      onValueChange={setDefaultCurrency}
                    >
                      <SelectTrigger className="mt-2 w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="LBP">LBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Default Language</Label>
                    <Select
                      value={defaultLanguage}
                      onValueChange={setDefaultLanguage}
                    >
                      <SelectTrigger className="mt-2 w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ar">Arabic</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={prefsSaving}>
                    {prefsSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>Push Notifications</CardTitle>
              <CardDescription>
                Receive notifications even when the app is closed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Enable Push Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Get notified on your device when you receive new notifications
                  </p>
                </div>
                <Button
                  variant={pushEnabled ? "outline" : "default"}
                  onClick={() => handleTogglePush(!pushEnabled)}
                  disabled={pushLoading || pushStatus === "denied"}
                >
                  {pushEnabled ? "Disable" : "Enable"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {pushStatus === "denied"
                  ? "Push notifications are blocked by your browser. Go to your browser settings to allow notifications for this site."
                  : pushEnabled
                    ? "Notifications: Enabled ✓"
                    : "Notifications: Disabled"}
              </p>
              {typeof navigator !== "undefined" &&
                /iPhone|iPad|iPod/.test(navigator.userAgent) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                    For notifications on iPhone, add this app to your Home Screen
                    first (tap Share → Add to Home Screen).
                  </div>
                )}
              {typeof window !== "undefined" && !window.isSecureContext && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-800 dark:bg-red-950/30">
                  Push requires HTTPS. You&apos;re on HTTP — use https:// in the address bar or deploy with SSL (e.g. Vercel provides HTTPS automatically).
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "audit" && (
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Track all system activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Select
                  value={auditTypeFilter}
                  onValueChange={setAuditTypeFilter}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="car">Cars</SelectItem>
                    <SelectItem value="part">Parts</SelectItem>
                    <SelectItem value="customer">Customers</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={auditUserFilter}
                  onValueChange={setAuditUserFilter}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {auditUsers.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={auditDateFilter}
                  onValueChange={setAuditDateFilter}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Last 24h</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {auditLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : filteredAudit.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No activity found
                </p>
              ) : (
                <div className="space-y-1 rounded-lg border">
                  {filteredAudit.map((item) => (
                    <Link
                      key={item.id}
                      href={item.link ?? "#"}
                      className="flex items-center gap-4 border-b p-3 text-left transition-colors last:border-0 hover:bg-muted/50"
                    >
                      <span className="shrink-0 text-sm text-muted-foreground w-16">
                        {timeAgo(item.time)}
                      </span>
                      <span className="shrink-0 font-medium w-24">{item.user}</span>
                      <span className="min-w-0 flex-1 truncate">{item.action}</span>
                      {item.details && (
                        <span className="shrink-0 text-muted-foreground text-sm">
                          {item.details}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "pending-requests" && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>
                All pending items requiring action: deletions, employee requests, document access, page access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingItemsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : pendingItems.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No pending requests
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Type</th>
                        <th className="px-4 py-3 text-left font-medium">Details</th>
                        <th className="px-4 py-3 text-left font-medium">Requested By</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingItems.map((r) => {
                        const deleteId = r.type === "delete" ? r.id.replace("del-", "") : null;
                        return (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-xs font-medium",
                                  r.type === "delete" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                                  r.type === "request" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                  r.type === "document_access" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                  r.type === "page_access" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                )}
                              >
                                {r.typeLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {r.link ? (
                                <Link href={r.link} className="text-primary hover:underline truncate block max-w-[200px]">
                                  {r.subject ?? "—"}
                                </Link>
                              ) : (
                                r.subject ?? "—"
                              )}
                            </td>
                            <td className="px-4 py-3">{r.requester_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(r.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {r.type === "delete" && deleteId ? (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApproveDelete(deleteId)}
                                    disabled={deleteActioning === deleteId}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDenyDelete(deleteId)}
                                    disabled={deleteActioning === deleteId}
                                  >
                                    Deny
                                  </Button>
                                </div>
                              ) : (
                                <Link href={r.link ?? "#"}>
                                  <Button size="sm" variant="outline">View</Button>
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <EditTeamMemberDialog
        profile={editProfile}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditProfile(null);
        }}
        onSuccess={fetchProfiles}
      />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  );
}
