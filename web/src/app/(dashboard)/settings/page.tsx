"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { UserCapability } from "@/lib/contexts/UserContext";
import type { AppRole } from "@/lib/permissions";
import { USER_ROLE_LABELS } from "@/lib/constants/user";
import {
  Users,
  UserPlus,
  Building2,
  Settings,
  FileText,
  Pencil,
  Power,
  PowerOff,
  Bell,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditTeamMemberDialog } from "@/components/settings/EditTeamMemberDialog";
import { AddEmployeeDialog } from "@/components/settings/AddEmployeeDialog";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { TwoFactorAuthSection } from "@/components/settings/TwoFactorAuthSection";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { getProfileFullName } from "@/lib/supabase-profile";
import { ProfileActivityDot } from "@/components/profile-activity-dot";
import { DatabaseComputeSection } from "@/components/settings/DatabaseComputeSection";
import { formatError } from "@/lib/error-messages";
import { invalidateProfilesCache } from "@/lib/user-lookup";

function formatLastOnline(iso: string | null | undefined): string {
  if (!iso) return "Never";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

const ALL_TABS = [
  { id: "profile", label: "Profile", icon: User, everyone: true },
  { id: "notifications", label: "Notifications", icon: Bell, everyone: true },
  { id: "team", label: "Team", icon: Users, everyone: false },
  { id: "company", label: "Company", icon: Building2, everyone: false },
  { id: "prefs", label: "Preferences", icon: Settings, everyone: false },
  { id: "audit", label: "Audit Log", icon: FileText, everyone: false },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  sales: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  garage_manager:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  assistant: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

interface ProfileRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title?: string | null;
  department?: string | null;
  user_role: AppRole | null;
  capabilities: UserCapability[];
  is_active: boolean;
  employment_status?: string | null;
  terminated_at?: string | null;
  created_at?: string;
  last_active_at?: string | null;
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
  const {
    canSeeSettings,
    canSeeProfileSettings,
    canSeeMyRequests,
    profile,
    refreshProfile,
    isOwner,
    hasCapability,
  } = useUser();
  const canEditApprovalThresholds = isOwner || hasCapability("manage_team");
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
  const [addOpen, setAddOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [deactivateTarget, setDeactivateTarget] = useState<ProfileRow | null>(null);

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

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushStatus, setPushStatus] = useState<string>("");
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushSending, setTestPushSending] = useState(false);

  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [profileLanguage, setProfileLanguage] = useState("en");
  const [savingLanguage, setSavingLanguage] = useState(false);

  const supabase = createClient();

  const canAccessSettings = canSeeSettings || canSeeProfileSettings || canSeeMyRequests;

  useEffect(() => {
    if (!canAccessSettings) {
      router.replace("/dashboard");
      return;
    }
  }, [canAccessSettings, router]);

  const fetchProfiles = useCallback(async () => {
    // Team list reloads after every add/edit/deactivate — drop the shared
    // profile cache so name-based notification lookups don't go stale.
    invalidateProfilesCache();
    setProfilesLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast.error(formatError(error));
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

  useEffect(() => {
    const lang = (profile?.preferred_language ?? "en").trim() || "en";
    setProfileLanguage(lang);
  }, [profile?.preferred_language]);

  async function saveProfileLanguage(value: string) {
    setProfileLanguage(value);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be signed in.");
      return;
    }
    setSavingLanguage(true);
    const { error } = await supabase
      .from("profiles")
      .update({ preferred_language: value || "en" })
      .eq("id", user.id);
    setSavingLanguage(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Language preference saved");
    await refreshProfile();
  }

  const fetchPrefs = useCallback(async () => {
    setPrefsLoading(true);
    const { data, error } = await supabase.from("system_preferences").select("*");

    if (error) {
      toast.error(formatError(error));
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
      toast.error(`Failed to save: ${formatError(error)}`);
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

  async function handleToggleActive(p: ProfileRow) {
    const willActivate = !p.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({
        is_active: willActivate,
        employment_status: willActivate ? "active" : "inactive",
        terminated_at: willActivate ? null : new Date().toISOString(),
        termination_reason: willActivate ? null : undefined,
      })
      .eq("id", p.id);

    if (error) {
      toast.error(formatError(error));
    } else {
      toast.success(willActivate ? "Employee reactivated" : "Employee deactivated");
      fetchProfiles();
      if (p.id === profile?.id) refreshProfile();
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

    // Apply the date filter server-side BEFORE the limit so the 50 most-recent
    // rows are drawn from the chosen window, not silently truncated to rows
    // newer than whatever the limit happened to capture.
    const carQuery = supabase
      .from("car_events")
      .select("*, profiles:created_by(full_name), cars:car_id(vin, brand, model)")
      .order("created_at", { ascending: false })
      .limit(50);
    const partQuery = supabase
      .from("part_movements")
      .select("*, profiles:created_by(full_name), parts:part_id(part_name, oe_number), cars:car_id(vin, brand, model)")
      .order("created_at", { ascending: false })
      .limit(50);
    const noteQuery = supabase
      .from("customer_notes")
      .select("*, profiles:created_by(full_name), customers:customer_id(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (cutoff) {
      carQuery.gte("created_at", cutoff);
      partQuery.gte("created_at", cutoff);
      noteQuery.gte("created_at", cutoff);
    }

    const [carRes, partRes, noteRes] = await Promise.all([
      carQuery,
      partQuery,
      noteQuery,
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

    (carRes.data ?? []).forEach((ev: any) => {
      if (cutoff && ev.created_at < cutoff) return;
      const profiles = Array.isArray(ev.profiles) ? ev.profiles[0] : ev.profiles;
      const name = getProfileFullName(profiles);
      const user = name !== "Unknown" ? name : "System";
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

    (partRes.data ?? []).forEach((mov: any) => {
      if (cutoff && mov.created_at < cutoff) return;
      const profiles = Array.isArray(mov.profiles) ? mov.profiles[0] : mov.profiles;
      const name = getProfileFullName(profiles);
      const user = name !== "Unknown" ? name : "System";
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

    (noteRes.data ?? []).forEach((n: any) => {
      if (cutoff && n.created_at < cutoff) return;
      const profiles = Array.isArray(n.profiles) ? n.profiles[0] : n.profiles;
      const name = getProfileFullName(profiles);
      const user = name !== "Unknown" ? name : "System";
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
    <div className="container mx-auto flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 md:px-6 lg:flex-row">
      {/* Tabs sidebar - horizontally scrollable on mobile, vertical on desktop */}
      <nav
        className="flex shrink-0 flex-row flex-nowrap gap-2 overflow-x-auto border-b pb-4 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6 max-md:-mx-4 max-md:px-4 max-md:scrollbar-hide"
        data-tour-id="settings-tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <tab.icon className="size-4 shrink-0" />
            {tab.label}
          </button>
        ))}
        {canEditApprovalThresholds && (
          <Link
            data-tour-id="settings-approval-thresholds-link"
            href="/settings/approval-thresholds"
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
              "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <SlidersHorizontal className="size-4 shrink-0" />
            Approval thresholds
          </Link>
        )}
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {activeTab === "profile" && (
          <Card data-tour-id="settings-profile-panel">
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your account and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-4 sm:px-6 md:gap-6">
              <div className="rounded-lg border p-4">
                <p className="font-medium text-base">{profile?.full_name ?? "User"}</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.phone ?? "No phone"}{" "}
                  · {profile?.user_role ? USER_ROLE_LABELS[profile.user_role] : "Signed in"}
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">
                    Change your password to keep your account secure
                  </p>
                </div>
                <Button data-tour-id="settings-change-password-button" variant="outline" onClick={() => setChangePasswordOpen(true)} className="w-full min-h-[44px] sm:w-auto">
                  Change Password
                </Button>
              </div>
              <TwoFactorAuthSection />
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">Language</p>
                  <p className="text-sm text-muted-foreground">
                    Sets the HTML language for the app (full translations may follow). Saved on your profile.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-48">
                  <Select
                    value={profileLanguage}
                    onValueChange={(v) => void saveProfileLanguage(v)}
                    disabled={savingLanguage}
                  >
                    <SelectTrigger id="profile-preferred-language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">Onboarding Tour</p>
                    <p className="text-sm text-muted-foreground">
                      Walk through the main features of Monza App for your role.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tour completed on:{" "}
                      {profile?.onboarding_completed_at != null
                        ? new Date(profile.onboarding_completed_at).toLocaleString()
                        : "Not completed yet"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] sm:w-auto"
                    onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        toast.error("You must be signed in to start the tour.");
                        return;
                      }
                      const { error } = await supabase
                        .from("profiles")
                        .update({
                          onboarding_completed: false,
                          onboarding_completed_at: null,
                        })
                        .eq("id", user.id);
                      if (error) {
                        const msg = error.message?.includes("onboarding_completed_at")
                          ? "Database migration needed. Run: supabase db push"
                          : error.message;
                        toast.error(msg);
                        return;
                      }
                      toast.success("Onboarding tour will start on your next page.");
                      router.replace("/requests");
                    }}
                  >
                    Take Onboarding Tour Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "team" && (
          <Card data-tour-id="settings-team-panel">
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your team&apos;s access and roles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "active" | "inactive" | "all")}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
                <Button data-tour-id="settings-add-employee-button" onClick={() => setAddOpen(true)}>
                  <UserPlus className="mr-2 size-4" />
                  Add Employee
                </Button>
              </div>
              {profilesLoading ? (
                <div className="overflow-hidden rounded-lg border">
                  <div className="space-y-2 p-4">
                    <Skeleton className="h-8 w-full" />
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const filtered = statusFilter === "all"
                      ? profiles
                      : statusFilter === "active"
                        ? profiles.filter((p) => p.is_active)
                        : profiles.filter((p) => !p.is_active);
                    return filtered.length === 0 ? (
                      <p className="text-muted-foreground">No team members match the filter.</p>
                    ) : (
                    <>
                  {/* Mobile: cards */}
                  <div className="space-y-3 md:hidden">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full flex-col gap-2 rounded-lg border border-border/50 bg-card p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70 min-h-[44px]"
                        onClick={() => {
                          setEditProfile(p);
                          setEditOpen(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-base">{p.full_name}</p>
                          <span
                            className={cn(
                              "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                              p.user_role ? ROLE_COLORS[p.user_role] ?? "bg-muted" : "bg-muted"
                            )}
                          >
                            {p.user_role ? USER_ROLE_LABELS[p.user_role] : "Unassigned"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.email ? (
                            <a
                              href={`mailto:${p.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              {p.email}
                            </a>
                          ) : (
                            "—"
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {p.phone ? (
                            <a
                              href={`tel:${p.phone.replace(/\s/g, "")}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              {p.phone}
                            </a>
                          ) : (
                            "—"
                          )}
                        </p>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span>
                            <span className="font-medium text-foreground">Account: </span>
                            {p.is_active ? "Enabled" : "Deactivated"}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <ProfileActivityDot lastActiveAt={p.last_active_at} />
                            <span className="text-foreground">Last online: {formatLastOnline(p.last_active_at)}</span>
                          </span>
                          <span>
                            Joined: {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {/* Desktop: table without capabilities */}
                  <div className="hidden overflow-x-auto rounded-lg border md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-3 text-left font-medium">Name</th>
                          <th className="px-4 py-3 text-left font-medium">Role</th>
                          <th className="px-4 py-3 text-left font-medium">Account</th>
                          <th className="px-4 py-3 text-left font-medium">Last online</th>
                          <th className="px-4 py-3 text-left font-medium">Email</th>
                          <th className="px-4 py-3 text-left font-medium">Phone</th>
                          <th className="px-4 py-3 text-left font-medium">Joined</th>
                          <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((p) => (
                          <tr key={p.id} className="border-b last:border-0">
                            <td className="px-4 py-3 font-medium">{p.full_name}</td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-xs font-medium",
                                  p.user_role ? ROLE_COLORS[p.user_role] ?? "bg-muted" : "bg-muted"
                                )}
                              >
                                {p.user_role ? USER_ROLE_LABELS[p.user_role] : "Unassigned"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium",
                                  p.is_active
                                    ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                )}
                              >
                                {p.is_active ? "Enabled" : "Deactivated"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <ProfileActivityDot lastActiveAt={p.last_active_at} />
                                <span className="text-xs text-muted-foreground">
                                  {formatLastOnline(p.last_active_at)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.email ? (
                                <a href={`mailto:${p.email}`} className="text-primary hover:underline">
                                  {p.email}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.phone ? (
                                <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                                  {p.phone}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
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
                                  onClick={() => {
                                    if (p.is_active) {
                                      setDeactivateTarget(p);
                                    } else {
                                      void handleToggleActive(p);
                                    }
                                  }}
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
                </>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "company" && (
          <Card data-tour-id="settings-company-panel">
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Monza S.A.L. details</CardDescription>
            </CardHeader>
            <CardContent>
              {prefsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                  <Skeleton className="h-10 w-32" />
                </div>
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
          <div className="space-y-6">
            <Card data-tour-id="settings-prefs-panel">
              <CardHeader>
                <CardTitle>System Preferences</CardTitle>
                <CardDescription>Default settings for the system</CardDescription>
              </CardHeader>
              <CardContent>
                {prefsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-[180px]" />
                      </div>
                    ))}
                    <Skeleton className="h-10 w-32" />
                  </div>
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
            {isOwner && <DatabaseComputeSection />}
          </div>
        )}

        {activeTab === "notifications" && (
          <Card data-tour-id="settings-notifications-panel">
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
                  data-tour-id="settings-push-toggle"
                  variant={pushEnabled ? "outline" : "default"}
                  onClick={() => handleTogglePush(!pushEnabled)}
                  disabled={pushLoading || pushStatus === "denied"}
                >
                  {pushEnabled ? "Disable" : "Enable"}
                </Button>
              </div>
              {pushEnabled && profile?.id && (
                <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
                  <div>
                    <p className="font-medium">Send a test notification</p>
                    <p className="text-sm text-muted-foreground">
                      Pushes a sample notification to every device where you&apos;ve enabled push.
                      Close the app first to confirm it arrives in the background.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={testPushSending}
                    onClick={async () => {
                      if (!profile?.id) return;
                      setTestPushSending(true);
                      try {
                        const res = await fetch("/api/send-push", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            user_id: profile.id,
                            title: "Monza App test push",
                            message: "If you're seeing this on your phone, push notifications are working.",
                            link: "/settings?tab=notifications",
                            tag: "test-push",
                          }),
                        });
                        const data = (await res.json().catch(() => null)) as
                          | { sent?: number; pruned?: number; error?: string }
                          | null;
                        if (!res.ok) {
                          toast.error(data?.error ?? `Server returned ${res.status}`);
                        } else if ((data?.sent ?? 0) === 0) {
                          toast.warning(
                            "No subscriptions reachable. Either the VAPID server keys aren't set on Vercel, or your saved subscription endpoint is dead. Re-toggle Enable, or set VAPID env vars."
                          );
                        } else {
                          toast.success(
                            `Pushed to ${data?.sent} device${data?.sent === 1 ? "" : "s"}.`
                          );
                        }
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Could not reach the push endpoint."
                        );
                      } finally {
                        setTestPushSending(false);
                      }
                    }}
                  >
                    {testPushSending ? "Sending…" : "Send test"}
                  </Button>
                </div>
              )}
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
          <Card data-tour-id="settings-audit-panel">
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
                <div className="space-y-1 rounded-lg border p-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
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

      </div>

      <EditTeamMemberDialog
        profile={editProfile}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditProfile(null);
        }}
        onSuccess={fetchProfiles}
        currentUserId={profile?.id}
        onRefreshSelf={refreshProfile}
      />
      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={fetchProfiles}
      />
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
      <AlertDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivateTarget ? getProfileFullName(deactivateTarget) : "this user"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to the system immediately and won&apos;t be able to
              sign in. You can reactivate them later from this same screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateTarget) {
                  void handleToggleActive(deactivateTarget);
                  setDeactivateTarget(null);
                }
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
