"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GARAGE_RESOURCE_LABELS,
  isGarageGmIncrementOnlyResource,
} from "@/lib/constants/garage-workflow";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatError } from "@/lib/error-messages";

type CapRow = {
  resource_name: string;
  capacity: number;
  usage_count: number;
  updated_at: string;
};

export default function GarageWorkflowSettingsPage() {
  const { appRole } = useUser();
  const canUsePage =
    appRole === "owner" || appRole === "garage_manager" || appRole === "hybrid";
  const canManageTemplates = appRole === "owner" || appRole === "garage_manager";
  const isGm = appRole === "garage_manager";
  const supabase = createClient();

  const [caps, setCaps] = useState<CapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [templates, setTemplates] = useState<{ id: string; name: string; is_system: boolean }[]>([]);
  const [itemsByTpl, setItemsByTpl] = useState<Record<string, { id: string; description: string; sort_order: number; default_resource_type: string | null }[]>>({});

  const [newTplOpen, setNewTplOpen] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newItemTplId, setNewItemTplId] = useState<string | null>(null);
  const [newItemDesc, setNewItemDesc] = useState("");
  const [tplToDelete, setTplToDelete] = useState<{ id: string; name: string } | null>(null);

  const loadCapacities = useCallback(async () => {
    const res = await fetch("/api/garage/capacities", { credentials: "include" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(j?.error ?? "Failed to load capacities");
      return;
    }
    setCaps((j.capacities as CapRow[]) ?? []);
  }, []);

  const loadTemplates = useCallback(async () => {
    const { data: tpl, error } = await supabase
      .from("garage_task_templates")
      .select("id, name, is_system")
      .order("name");
    if (error) {
      toast.error(formatError(error));
      return;
    }
    const list = (tpl as typeof templates) ?? [];
    setTemplates(list);
    if (list.length === 0) {
      setItemsByTpl({});
      return;
    }
    const ids = list.map((t) => t.id);
    const { data: itemRows, error: iErr } = await supabase
      .from("garage_task_template_items")
      .select("id, template_id, description, sort_order, default_resource_type")
      .in("template_id", ids)
      .order("sort_order");
    if (iErr) {
      toast.error(formatError(iErr));
      return;
    }
    type ItemRow = {
      id: string;
      template_id: string;
      description: string;
      sort_order: number;
      default_resource_type: string | null;
    };
    const g: Record<string, ItemRow[]> = {};
    for (const id of ids) g[id] = [];
    for (const r of (itemRows as ItemRow[] | null) ?? []) {
      if (!g[r.template_id]) g[r.template_id] = [];
      g[r.template_id].push(r);
    }
    setItemsByTpl(g);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadCapacities(), loadTemplates()]);
      setLoading(false);
    })();
  }, [loadCapacities, loadTemplates]);

  async function saveCapacity(resourceName: string, value: string) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Capacity must be a non-negative integer");
      return;
    }
    setSaving(resourceName);
    const res = await fetch("/api/garage/capacities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ resource_name: resourceName, capacity: n }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Save failed");
      return;
    }
    toast.success("Capacity updated");
    await loadCapacities();
  }

  async function incrementCapacity(resourceName: string, current: number) {
    setSaving(resourceName);
    const res = await fetch("/api/garage/capacities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ resource_name: resourceName, capacity: current + 1 }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(null);
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Save failed");
      return;
    }
    toast.success("Capacity +1");
    await loadCapacities();
  }

  async function createTemplate() {
    const name = newTplName.trim();
    if (!name) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("garage_task_templates").insert({
      name,
      is_system: false,
      created_by: u.user?.id ?? null,
    });
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Template created");
    setNewTplOpen(false);
    setNewTplName("");
    await loadTemplates();
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase.from("garage_task_templates").delete().eq("id", id);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Template removed");
    await loadTemplates();
  }

  async function addItem(templateId: string) {
    const desc = newItemDesc.trim();
    if (!desc) return;
    const list = itemsByTpl[templateId] ?? [];
    const { error } = await supabase.from("garage_task_template_items").insert({
      template_id: templateId,
      description: desc,
      sort_order: list.length,
      default_resource_type: null,
    });
    if (error) {
      toast.error(formatError(error));
      return;
    }
    setNewItemDesc("");
    setNewItemTplId(null);
    await loadTemplates();
  }

  async function deleteItem(itemId: string) {
    const { error } = await supabase.from("garage_task_template_items").delete().eq("id", itemId);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    await loadTemplates();
  }

  if (!canUsePage) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Only owners, Khalil, and garage managers can open garage workflow settings.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        Loading…
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Garage workflow setup</h1>
        <p className="text-muted-foreground text-sm">Capacities and task templates (RLS applies)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource capacities</CardTitle>
          <CardDescription>Usage = tasks in pending or in_progress with this resource_type</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {caps.map((c) => {
            const gmCarWashLocked = isGm && c.resource_name === "car_wash";
            const gmIncrementOnly = isGm && isGarageGmIncrementOnlyResource(c.resource_name);

            return (
              <div key={c.resource_name} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label>{GARAGE_RESOURCE_LABELS[c.resource_name] ?? c.resource_name}</Label>
                  <p className="text-muted-foreground text-xs">
                    In use: {c.usage_count} / {c.capacity}
                  </p>
                  {gmCarWashLocked ? (
                    <p className="text-muted-foreground text-xs">
                      Capacity changes for car wash are limited to owners and Khalil.
                    </p>
                  ) : null}
                  {gmIncrementOnly ? (
                    <p className="text-muted-foreground text-xs">
                      As garage manager you can only add +1 per save.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {gmCarWashLocked ? null : gmIncrementOnly ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving === c.resource_name}
                      onClick={() => void incrementCapacity(c.resource_name, c.capacity)}
                    >
                      {saving === c.resource_name ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        "+1 capacity"
                      )}
                    </Button>
                  ) : (
                    <>
                      <Input
                        type="number" inputMode="decimal"
                        min={0}
                        className="w-28"
                        key={`${c.resource_name}-${c.capacity}`}
                        defaultValue={c.capacity}
                        id={`cap-${c.resource_name}`}
                        disabled={saving === c.resource_name}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={saving === c.resource_name}
                        onClick={() => {
                          const el = document.getElementById(
                            `cap-${c.resource_name}`
                          ) as HTMLInputElement | null;
                          if (el) void saveCapacity(c.resource_name, el.value);
                        }}
                      >
                        {saving === c.resource_name ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {canManageTemplates ? (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Task templates</CardTitle>
            <CardDescription>Checklist models used on the task board</CardDescription>
          </div>
          <Button type="button" size="sm" className="gap-1" onClick={() => setNewTplOpen(true)}>
            <Plus className="size-4" />
            New template
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <Dialog open={newTplOpen} onOpenChange={setNewTplOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New template</DialogTitle>
                <DialogDescription>Name only; add lines below after creating.</DialogDescription>
              </DialogHeader>
              <Input value={newTplName} onChange={(e) => setNewTplName(e.target.value)} placeholder="Name" />
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewTplOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void createTemplate()}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border/80 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {t.name}
                    {t.is_system ? (
                      <span className="text-muted-foreground ml-2 text-xs">(system)</span>
                    ) : null}
                  </p>
                </div>
                {!t.is_system ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setTplToDelete({ id: t.id, name: t.name })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <ul className="mb-3 space-y-2 text-sm">
                {(itemsByTpl[t.id] ?? []).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-1">
                    <span>{it.description}</span>
                    <Button type="button" variant="ghost" size="icon" onClick={() => void deleteItem(it.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="New line description"
                  value={newItemTplId === t.id ? newItemDesc : ""}
                  onChange={(e) => {
                    setNewItemTplId(t.id);
                    setNewItemDesc(e.target.value);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setNewItemTplId(t.id);
                    void addItem(t.id);
                  }}
                >
                  Add line
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      ) : (
        <p className="text-muted-foreground text-sm">
          Task templates are managed by owners and garage managers.
        </p>
      )}

      <AlertDialog
        open={tplToDelete !== null}
        onOpenChange={(open) => !open && setTplToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{tplToDelete?.name ?? ""}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template and all of its checklist lines. Existing
              jobs that already pulled lines from this template are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (tplToDelete) {
                  void deleteTemplate(tplToDelete.id);
                  setTplToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
