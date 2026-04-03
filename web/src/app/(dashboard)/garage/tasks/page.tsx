"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Square, ClipboardList } from "lucide-react";
import {
  GARAGE_RESOURCE_KEYS,
  GARAGE_RESOURCE_LABELS,
  GARAGE_TASK_STATUS_OPTIONS,
} from "@/lib/constants/garage-workflow";

type TaskRow = {
  id: string;
  car_id: string;
  description: string;
  status: string;
  assigned_to: string | null;
  resource_type: string | null;
  sort_order: number;
  cars?: { id: string; vin: string; brand: string; model: string; status: string } | null;
};

type ProfileOpt = { id: string; full_name: string | null };

const POLL_MS = 5000;

function statusBadgeVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "done") return "secondary";
  if (s === "cancelled") return "outline";
  if (s === "blocked") return "destructive";
  if (s === "in_progress") return "default";
  return "outline";
}

export default function GarageTasksBoardPage() {
  const supabase = createClient();
  const { appRole, profile } = useUser();
  const canManage = appRole === "owner" || appRole === "garage_manager";

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [openTimers, setOpenTimers] = useState<
    { id: string; task_id: string; start_time: string; user_id: string }[]
  >([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [carsPick, setCarsPick] = useState<{ id: string; vin: string; brand: string; model: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [templateOpen, setTemplateOpen] = useState(false);
  const [tplCarId, setTplCarId] = useState("");
  const [tplTemplateId, setTplTemplateId] = useState("");
  const [tplSubmitting, setTplSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/garage/tasks", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status !== 401) toast.error(j?.error ?? "Failed to load tasks");
      return;
    }
    setTasks((j.tasks as TaskRow[]) ?? []);
  }, []);

  const loadTimers = useCallback(async () => {
    const res = await fetch("/api/garage/timers", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setOpenTimers((j.openTimers as typeof openTimers) ?? []);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadTasks(), loadTimers()]);
  }, [loadTasks, loadTimers]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refresh();
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, user_role")
        .in("user_role", ["owner", "garage_manager", "garage_staff"] as string[])
        .order("full_name");
      setProfiles((prof as ProfileOpt[]) ?? []);

      const { data: tpl } = await supabase.from("garage_task_templates").select("id, name").order("name");
      setTemplates((tpl as { id: string; name: string }[]) ?? []);

      const { data: carRows } = await supabase
        .from("cars")
        .select("id, vin, brand, model")
        .eq("status", "service")
        .is("deleted_at", null)
        .order("vin", { ascending: true })
        .limit(300);
      setCarsPick((carRows as typeof carsPick) ?? []);

      setLoading(false);
    })();
  }, [refresh, supabase]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status !== "done" && t.status !== "cancelled"),
    [tasks]
  );

  const byCar = useMemo(() => {
    const m = new Map<string, TaskRow[]>();
    for (const t of activeTasks) {
      const list = m.get(t.car_id) ?? [];
      list.push(t);
      m.set(t.car_id, list);
    }
    return m;
  }, [activeTasks]);

  function elapsedForTimer(startIso: string): string {
    const s = new Date(startIso).getTime();
    const sec = Math.max(0, Math.floor((Date.now() - s) / 1000));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const r = sec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
  }

  function openTimerForTask(taskId: string) {
    return openTimers.find((t) => t.task_id === taskId && t.user_id === profile?.id) ?? null;
  }

  async function patchTask(id: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/garage/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Update failed");
      return false;
    }
    await refresh();
    return true;
  }

  async function startTimer(taskId: string) {
    const res = await fetch("/api/garage/timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "start", taskId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Could not start timer");
      return;
    }
    await loadTimers();
  }

  async function stopTimer(taskId: string) {
    const res = await fetch("/api/garage/timers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "stop", taskId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Could not stop timer");
      return;
    }
    await loadTimers();
  }

  async function deleteTask(id: string) {
    if (!canManage) return;
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/garage/tasks/${id}`, { method: "DELETE", credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Delete failed");
      return;
    }
    await refresh();
  }

  async function submitTemplateChecklist() {
    if (!tplCarId || !tplTemplateId) {
      toast.error("Choose a car and a template.");
      return;
    }
    setTplSubmitting(true);
    const res = await fetch("/api/garage/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ carId: tplCarId, templateId: tplTemplateId }),
    });
    const j = await res.json().catch(() => ({}));
    setTplSubmitting(false);
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Failed to create tasks");
      return;
    }
    toast.success(`Created ${(j.tasks as unknown[])?.length ?? 0} task(s)`);
    setTemplateOpen(false);
    setTplCarId("");
    setTplTemplateId("");
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        Loading task board…
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Garage task board</h1>
          <p className="text-muted-foreground text-sm">
            Active tasks grouped by car · timers refresh every {POLL_MS / 1000}s
          </p>
        </div>
        {canManage ? (
          <Button type="button" className="gap-2" onClick={() => setTemplateOpen(true)}>
            <ClipboardList className="size-4" />
            Create checklist from template
          </Button>
        ) : null}
      </div>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create checklist from template</DialogTitle>
            <DialogDescription>
              Adds one task per template line for the selected vehicle (service cars listed).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Car</Label>
              <Select value={tplCarId} onValueChange={setTplCarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select car" />
                </SelectTrigger>
                <SelectContent>
                  {carsPick.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.brand} {c.model} · {c.vin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={tplTemplateId} onValueChange={setTplTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={tplSubmitting} onClick={() => void submitTemplateChecklist()}>
              {tplSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Create tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {byCar.size === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            No active garage tasks. Use{" "}
            <strong>Create checklist from template</strong> (owner / manager) or set a car to{" "}
            <strong>Service</strong> to auto-bootstrap when saving the car.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...byCar.entries()].map(([carId, list]) => {
            const car = list[0]?.cars;
            const title = car
              ? `${car.brand} ${car.model} · ${car.vin}`
              : `Car ${carId.slice(0, 8)}…`;
            return (
              <Card key={carId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{title}</CardTitle>
                  <CardDescription>{list.length} active task(s)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {list.map((t) => {
                    const mine = openTimerForTask(t.id);
                    return (
                      <div
                        key={t.id}
                        className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4 sm:flex-row sm:flex-wrap sm:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="font-medium">{t.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={statusBadgeVariant(t.status)}>{t.status.replace("_", " ")}</Badge>
                            {mine ? (
                              <Badge variant="outline" className="font-mono">
                                ▶ {elapsedForTimer(mine.start_time)}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:w-48">
                          <Label className="text-xs">Status</Label>
                          <Select
                            value={t.status}
                            onValueChange={(v) => void patchTask(t.id, { status: v })}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GARAGE_TASK_STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2 sm:w-52">
                          <Label className="text-xs">Assigned</Label>
                          <Select
                            value={t.assigned_to ?? "__none__"}
                            onValueChange={(v) =>
                              void patchTask(t.id, {
                                assigned_to: v === "__none__" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Unassigned</SelectItem>
                              {profiles.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.full_name ?? p.id.slice(0, 8)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-2 sm:w-44">
                          <Label className="text-xs">Resource</Label>
                          <Select
                            value={t.resource_type ?? "__none__"}
                            onValueChange={(v) =>
                              void patchTask(t.id, {
                                resource_type: v === "__none__" ? null : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {GARAGE_RESOURCE_KEYS.map((k) => (
                                <SelectItem key={k} value={k}>
                                  {GARAGE_RESOURCE_LABELS[k] ?? k}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mine ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => void stopTimer(t.id)}>
                              <Square className="mr-1 size-3.5" />
                              Stop
                            </Button>
                          ) : (
                            <Button type="button" size="sm" onClick={() => void startTimer(t.id)}>
                              <Play className="mr-1 size-3.5" />
                              Start
                            </Button>
                          )}
                          {canManage ? (
                            <Button type="button" size="sm" variant="destructive" onClick={() => void deleteTask(t.id)}>
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
