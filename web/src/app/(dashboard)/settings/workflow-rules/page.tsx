"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

const ROLES = ["owner", "assistant", "hybrid", "garage_manager", "garage_staff"] as const;

const CAPABILITIES = [
  "garage",
  "vehicle_software",
  "cashier",
  "events_ops",
  "manage_team",
  "edit_users",
  "deactivate_users",
  "view_reports",
  "inventory",
  "sales",
  "data_health",
] as const;

const NOTIF_CATEGORIES = [
  "mention",
  "assignment",
  "approval",
  "reply",
  "status_change",
  "alert",
  "customer",
  "critical",
] as const;

const NOTIF_SEVERITIES = ["info", "warning", "urgent", "critical"] as const;

interface Profile {
  id: string;
  full_name: string | null;
  user_role: string | null;
  is_active: boolean;
}

interface TaskCategory {
  id: string;
  label_en: string;
  sla_hours: number;
  default_severity: string;
  sort_order: number;
}

interface RoutingRule {
  id: string;
  category_id: string;
  assignee_kind: "user" | "role" | "capability";
  assignee_value: string;
  is_primary: boolean;
  is_parallel: boolean;
  role_label: string | null;
  note: string | null;
  sort_order: number;
  active: boolean;
}

interface NotifEventRule {
  id: string;
  event_type: string;
  description: string | null;
  category: string;
  severity: string;
  recipient_kind: "user" | "role" | "capability" | "event_subject_owner" | "event_submitter";
  recipient_value: string | null;
  channel_inapp: boolean;
  channel_email: boolean;
  channel_whatsapp: boolean;
  active: boolean;
  note: string | null;
}

export default function WorkflowRulesPage() {
  const { isOwner, hasCapability } = useUser();
  const allowed = isOwner || hasCapability("manage_team");

  if (!allowed) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to workflow rules.</p>
        <Button variant="link" asChild>
          <Link href="/settings">Back to settings</Link>
        </Button>
      </div>
    );
  }

  return <Body />;
}

function Body() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [eventRules, setEventRules] = useState<NotifEventRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "routing"; id: string; label: string }
    | { kind: "event"; id: string; label: string }
    | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, c, r, e] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, user_role, is_active")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("task_categories")
        .select("id, label_en, sla_hours, default_severity, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("task_routing_rules")
        .select("*")
        .order("category_id", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("notification_event_rules")
        .select("*")
        .order("event_type", { ascending: true }),
    ]);
    if (p.error) toast.error(`Profiles: ${formatError(p.error)}`);
    else setProfiles((p.data as Profile[]) ?? []);
    if (c.error) toast.error(`Categories: ${formatError(c.error)}`);
    else setCategories((c.data as TaskCategory[]) ?? []);
    if (r.error) toast.error(`Routing rules: ${formatError(r.error)}`);
    else setRoutingRules((r.data as RoutingRule[]) ?? []);
    if (e.error) toast.error(`Event rules: ${formatError(e.error)}`);
    else setEventRules((e.data as NotifEventRule[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  async function handleDeleteRouting(id: string) {
    const { error } = await supabase.from("task_routing_rules").delete().eq("id", id);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setRoutingRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Rule removed");
  }

  async function handleAddRouting(rule: Omit<RoutingRule, "id">) {
    const { data, error } = await supabase
      .from("task_routing_rules")
      .insert(rule)
      .select("*")
      .single();
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setRoutingRules((prev) => [...prev, data as RoutingRule]);
    toast.success("Rule added");
  }

  async function handleDeleteEvent(id: string) {
    const { error } = await supabase.from("notification_event_rules").delete().eq("id", id);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setEventRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Recipient removed");
  }

  async function handleAddEvent(rule: Omit<NotifEventRule, "id">) {
    const { data, error } = await supabase
      .from("notification_event_rules")
      .insert(rule)
      .select("*")
      .single();
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setEventRules((prev) => [...prev, data as NotifEventRule]);
    toast.success("Recipient added");
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workflow rules</h1>
          <p className="text-muted-foreground text-sm">
            Who gets a task when, and who hears about which event. Edits apply
            instantly to the next car arrival or event fire.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="mr-1 size-3" /> Settings
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="routing">
        <TabsList data-tour-id="workflow-rules-tabs">
          <TabsTrigger value="routing" data-tour-id="workflow-rules-tab-routing">
            Task routing
          </TabsTrigger>
          <TabsTrigger value="events" data-tour-id="workflow-rules-tab-events">
            Notification events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routing" className="space-y-4">
          <RoutingPane
            loading={loading}
            categories={categories}
            rules={routingRules}
            profiles={profiles}
            profileById={profileById}
            onDelete={(id, label) =>
              setConfirmDelete({ kind: "routing", id, label })
            }
            onAdd={handleAddRouting}
          />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <EventsPane
            loading={loading}
            rules={eventRules}
            profiles={profiles}
            profileById={profileById}
            onDelete={(id, label) =>
              setConfirmDelete({ kind: "event", id, label })
            }
            onAdd={handleAddEvent}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.label}. Removing it means nobody (or nobody from
              this row) will be auto-assigned / notified going forward. You can
              add it back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                if (confirmDelete.kind === "routing") {
                  void handleDeleteRouting(confirmDelete.id);
                } else {
                  void handleDeleteEvent(confirmDelete.id);
                }
                setConfirmDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Routing pane
// ---------------------------------------------------------------------------

function RoutingPane({
  loading,
  categories,
  rules,
  profiles,
  profileById,
  onDelete,
  onAdd,
}: {
  loading: boolean;
  categories: TaskCategory[];
  rules: RoutingRule[];
  profiles: Profile[];
  profileById: Map<string, Profile>;
  onDelete: (id: string, label: string) => void;
  onAdd: (rule: Omit<RoutingRule, "id">) => Promise<void>;
}) {
  const [selectedCatRaw, setSelectedCat] = useState<string>("");
  // Default to the first category until the user picks one explicitly.
  const selectedCat = selectedCatRaw || categories[0]?.id || "";

  const catRules = useMemo(
    () => rules.filter((r) => r.category_id === selectedCat),
    [rules, selectedCat]
  );

  const cat = categories.find((c) => c.id === selectedCat);

  return (
    <Card data-tour-id="workflow-rules-routing-panel">
      <CardHeader>
        <CardTitle className="text-base">Who gets the task</CardTitle>
        <CardDescription>
          Pick a category. Every row here adds a task assignee when a car
          intake is set to that category. <strong>Primary</strong> rules are
          the main owner; <strong>Parallel</strong> rules are CCs that work in
          parallel.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={selectedCat} onValueChange={setSelectedCat}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cat && (
            <div className="text-muted-foreground self-end text-xs">
              SLA <strong>{cat.sla_hours}h</strong> · default severity{" "}
              <strong>{cat.default_severity}</strong>
            </div>
          )}
        </div>

        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : catRules.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No routing rules for this category yet.
          </p>
        ) : (
          <ul className="divide-border bg-card divide-y rounded-md border">
            {catRules.map((r) => {
              const label = labelForRouting(r, profileById);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={r.is_primary ? "default" : "outline"}
                      className="h-5 px-1.5 text-[10px]"
                    >
                      {r.is_primary ? "Primary" : r.is_parallel ? "Parallel" : "CC"}
                    </Badge>
                    <span className="font-medium">{label}</span>
                    {r.role_label && (
                      <span className="text-muted-foreground text-xs">
                        — {r.role_label}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive h-7"
                    onClick={() => onDelete(r.id, label)}
                  >
                    <Trash2 className="mr-1 size-3" /> Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <AddRoutingForm
          categoryId={selectedCat}
          profiles={profiles}
          onAdd={onAdd}
        />
      </CardContent>
    </Card>
  );
}

function AddRoutingForm({
  categoryId,
  profiles,
  onAdd,
}: {
  categoryId: string;
  profiles: Profile[];
  onAdd: (rule: Omit<RoutingRule, "id">) => Promise<void>;
}) {
  const [kind, setKind] = useState<"user" | "role" | "capability">("user");
  const [value, setValue] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [isParallel, setIsParallel] = useState(false);
  const [roleLabel, setRoleLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setKind("user");
    setValue("");
    setIsPrimary(false);
    setIsParallel(false);
    setRoleLabel("");
  }

  async function submit() {
    if (!categoryId) {
      toast.error("Pick a category first");
      return;
    }
    if (!value) {
      toast.error("Pick who gets the task");
      return;
    }
    setSubmitting(true);
    await onAdd({
      category_id: categoryId,
      assignee_kind: kind,
      assignee_value: value,
      is_primary: isPrimary,
      is_parallel: isParallel,
      role_label: roleLabel.trim() || null,
      note: null,
      sort_order: 99,
      active: true,
    });
    setSubmitting(false);
    reset();
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <p className="text-sm font-medium">Add a routing rule</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Assign to</Label>
          <Select
            value={kind}
            onValueChange={(v) => {
              setKind(v as typeof kind);
              setValue("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">A specific person</SelectItem>
              <SelectItem value="role">A role pool</SelectItem>
              <SelectItem value="capability">Anyone with a capability</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Pick value</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {kind === "user" &&
                profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.id} ({p.user_role})
                  </SelectItem>
                ))}
              {kind === "role" &&
                ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              {kind === "capability" &&
                CAPABILITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Role label (optional, shown on the task)</Label>
          <Input
            value={roleLabel}
            onChange={(e) => setRoleLabel(e.target.value)}
            placeholder="e.g. Lara — DMS submission"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isPrimary}
              onCheckedChange={(v) => setIsPrimary(v === true)}
            />
            Primary owner
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isParallel}
              onCheckedChange={(v) => setIsParallel(v === true)}
            />
            Parallel CC
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={submitting || !value || !categoryId}
        >
          <Plus className="mr-1 size-3.5" /> Add rule
        </Button>
      </div>
    </div>
  );
}

function labelForRouting(r: RoutingRule, profileById: Map<string, Profile>): string {
  if (r.assignee_kind === "user") {
    const p = profileById.get(r.assignee_value);
    return p ? `${p.full_name ?? p.id} (user)` : `User ${r.assignee_value.slice(0, 8)}…`;
  }
  if (r.assignee_kind === "role") return `Role: ${r.assignee_value}`;
  return `Capability: ${r.assignee_value}`;
}

// ---------------------------------------------------------------------------
// Notification events pane
// ---------------------------------------------------------------------------

function EventsPane({
  loading,
  rules,
  profiles,
  profileById,
  onDelete,
  onAdd,
}: {
  loading: boolean;
  rules: NotifEventRule[];
  profiles: Profile[];
  profileById: Map<string, Profile>;
  onDelete: (id: string, label: string) => void;
  onAdd: (rule: Omit<NotifEventRule, "id">) => Promise<void>;
}) {
  const eventTypes = useMemo(() => {
    const map = new Map<string, NotifEventRule[]>();
    rules.forEach((r) => {
      const list = map.get(r.event_type) ?? [];
      list.push(r);
      map.set(r.event_type, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rules]);

  const [selectedEventRaw, setSelectedEvent] = useState<string>("");
  const selectedEvent = selectedEventRaw || eventTypes[0]?.[0] || "";

  const eventRules = useMemo(
    () => rules.filter((r) => r.event_type === selectedEvent),
    [rules, selectedEvent]
  );

  return (
    <Card data-tour-id="workflow-rules-events-panel">
      <CardHeader>
        <CardTitle className="text-base">Who hears about it</CardTitle>
        <CardDescription>
          Pick a notification event. Each row adds one recipient + channel
          configuration. To target the user attached to the record (e.g. the
          sales advisor on a test drive), use{" "}
          <span className="font-mono text-xs">event_subject_owner</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Event type</Label>
          <Select value={selectedEvent} onValueChange={setSelectedEvent}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an event" />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map(([key]) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : eventRules.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No recipients configured for this event yet.
          </p>
        ) : (
          <ul className="divide-border bg-card divide-y rounded-md border">
            {eventRules.map((r) => {
              const label = labelForEvent(r, profileById);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[10px] uppercase",
                        r.severity === "critical" && "border-red-500/40 text-red-700",
                        r.severity === "urgent" && "border-orange-500/40 text-orange-700",
                        r.severity === "warning" && "border-amber-500/40 text-amber-700"
                      )}
                    >
                      {r.severity}
                    </Badge>
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground flex gap-1 text-[11px]">
                      {r.channel_inapp && <span>· in-app</span>}
                      {r.channel_email && <span>· email</span>}
                      {r.channel_whatsapp && <span>· WhatsApp</span>}
                    </span>
                    {r.note && (
                      <span className="text-muted-foreground text-xs">
                        — {r.note}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive h-7"
                    onClick={() => onDelete(r.id, label)}
                  >
                    <Trash2 className="mr-1 size-3" /> Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <AddEventRuleForm
          eventType={selectedEvent}
          profiles={profiles}
          onAdd={onAdd}
        />

        <div className="border-t pt-3">
          <Label className="text-xs">Add a new event type</Label>
          <NewEventTypeForm
            profiles={profiles}
            onAdd={onAdd}
            onCreated={(et) => setSelectedEvent(et)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AddEventRuleForm({
  eventType,
  profiles,
  onAdd,
}: {
  eventType: string;
  profiles: Profile[];
  onAdd: (rule: Omit<NotifEventRule, "id">) => Promise<void>;
}) {
  const [recipientKind, setRecipientKind] = useState<
    "user" | "role" | "capability" | "event_subject_owner" | "event_submitter"
  >("user");
  const [recipientValue, setRecipientValue] = useState("");
  const [category, setCategory] = useState<string>("alert");
  const [severity, setSeverity] = useState<string>("info");
  const [chInApp, setChInApp] = useState(true);
  const [chEmail, setChEmail] = useState(false);
  const [chWhatsApp, setChWhatsApp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const needsValue =
    recipientKind === "user" ||
    recipientKind === "role" ||
    recipientKind === "capability";

  function reset() {
    setRecipientKind("user");
    setRecipientValue("");
    setCategory("alert");
    setSeverity("info");
    setChInApp(true);
    setChEmail(false);
    setChWhatsApp(false);
  }

  async function submit() {
    if (!eventType) {
      toast.error("Pick an event type first");
      return;
    }
    if (needsValue && !recipientValue) {
      toast.error("Pick who gets the notification");
      return;
    }
    if (!chInApp && !chEmail && !chWhatsApp) {
      toast.error("Pick at least one channel");
      return;
    }
    setSubmitting(true);
    await onAdd({
      event_type: eventType,
      description: null,
      category,
      severity,
      recipient_kind: recipientKind,
      recipient_value: needsValue ? recipientValue : null,
      channel_inapp: chInApp,
      channel_email: chEmail,
      channel_whatsapp: chWhatsApp,
      active: true,
      note: null,
    });
    setSubmitting(false);
    reset();
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <p className="text-sm font-medium">Add a recipient row</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Recipient kind</Label>
          <Select
            value={recipientKind}
            onValueChange={(v) => {
              setRecipientKind(v as typeof recipientKind);
              setRecipientValue("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">A specific person</SelectItem>
              <SelectItem value="role">A role pool</SelectItem>
              <SelectItem value="capability">Anyone with a capability</SelectItem>
              <SelectItem value="event_subject_owner">
                Subject of the record
              </SelectItem>
              <SelectItem value="event_submitter">Submitter of the request</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Value</Label>
          {needsValue ? (
            <Select value={recipientValue} onValueChange={setRecipientValue}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {recipientKind === "user" &&
                  profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.id}
                    </SelectItem>
                  ))}
                {recipientKind === "role" &&
                  ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                {recipientKind === "capability" &&
                  CAPABILITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value="(auto: pulled from the event)"
              disabled
              className="text-muted-foreground"
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIF_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTIF_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={chInApp}
              onCheckedChange={(v) => setChInApp(v === true)}
            />
            In-app + toast
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={chEmail}
              onCheckedChange={(v) => setChEmail(v === true)}
            />
            Email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={chWhatsApp}
              onCheckedChange={(v) => setChWhatsApp(v === true)}
            />
            WhatsApp
          </label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={submitting || !eventType || (needsValue && !recipientValue)}
        >
          <Plus className="mr-1 size-3.5" /> Add recipient
        </Button>
      </div>
    </div>
  );
}

function NewEventTypeForm({
  profiles,
  onAdd,
  onCreated,
}: {
  profiles: Profile[];
  onAdd: (rule: Omit<NotifEventRule, "id">) => Promise<void>;
  onCreated: (eventType: string) => void;
}) {
  const [eventType, setEventType] = useState("");
  const [recipientKind, setRecipientKind] = useState<
    "user" | "role" | "capability" | "event_subject_owner" | "event_submitter"
  >("role");
  const [recipientValue, setRecipientValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsValue =
    recipientKind === "user" ||
    recipientKind === "role" ||
    recipientKind === "capability";

  async function submit() {
    const et = eventType.trim();
    if (!et) {
      toast.error("Event type is required");
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(et)) {
      toast.error("Use lowercase letters, numbers, dots, dashes, underscores");
      return;
    }
    if (needsValue && !recipientValue) {
      toast.error("Pick at least a first recipient");
      return;
    }
    setSubmitting(true);
    await onAdd({
      event_type: et,
      description: null,
      category: "alert",
      severity: "info",
      recipient_kind: recipientKind,
      recipient_value: needsValue ? recipientValue : null,
      channel_inapp: true,
      channel_email: false,
      channel_whatsapp: false,
      active: true,
      note: null,
    });
    setSubmitting(false);
    setEventType("");
    setRecipientValue("");
    onCreated(et);
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3 items-end">
      <div className="space-y-1 sm:col-span-1">
        <Label className="text-xs">Event key</Label>
        <Input
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          placeholder="e.g. lead.assigned"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">First recipient kind</Label>
        <Select
          value={recipientKind}
          onValueChange={(v) => {
            setRecipientKind(v as typeof recipientKind);
            setRecipientValue("");
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">A specific person</SelectItem>
            <SelectItem value="role">A role pool</SelectItem>
            <SelectItem value="capability">Anyone with a capability</SelectItem>
            <SelectItem value="event_subject_owner">Subject of the record</SelectItem>
            <SelectItem value="event_submitter">Submitter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Value</Label>
        {needsValue ? (
          <Select value={recipientValue} onValueChange={setRecipientValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {recipientKind === "user" &&
                profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.id}
                  </SelectItem>
                ))}
              {recipientKind === "role" &&
                ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              {recipientKind === "capability" &&
                CAPABILITIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Input value="(auto)" disabled className="text-muted-foreground" />
        )}
      </div>
      <div className="sm:col-span-3 flex justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void submit()}
          disabled={submitting || !eventType.trim()}
        >
          <Plus className="mr-1 size-3.5" /> Create event type
        </Button>
      </div>
    </div>
  );
}

function labelForEvent(r: NotifEventRule, profileById: Map<string, Profile>): string {
  if (r.recipient_kind === "user") {
    if (!r.recipient_value) return "Unknown user";
    const p = profileById.get(r.recipient_value);
    return p ? p.full_name ?? "Unnamed user" : `User ${r.recipient_value.slice(0, 8)}…`;
  }
  if (r.recipient_kind === "role") return `Role: ${r.recipient_value ?? "?"}`;
  if (r.recipient_kind === "capability") return `Capability: ${r.recipient_value ?? "?"}`;
  if (r.recipient_kind === "event_subject_owner") return "Subject of the record";
  if (r.recipient_kind === "event_submitter") return "Submitter";
  return "Unknown";
}
