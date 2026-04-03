"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { canPerform } from "@/lib/permissions";
import type { AccessoryCustomItem, AccessoryCustomTable } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Loader2, MoreVertical, Pencil, Trash2, Table2 } from "lucide-react";

function profileName(t: AccessoryCustomTable): string | null {
  const p = t.profiles;
  if (!p) return null;
  const row = Array.isArray(p) ? p[0] : p;
  return row?.full_name ?? null;
}

export function CustomAccessoryCollections() {
  const supabase = createClient();
  const { profile, appRole, loading: userLoading } = useUser();
  const canCreateCollection = canPerform("accessory_collections", "create", appRole ?? null);
  const canEditCollection = canPerform("accessory_collections", "edit", appRole ?? null);
  const canDeleteCollection = canPerform("accessory_collections", "delete", appRole ?? null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tables, setTables] = useState<AccessoryCustomTable[]>([]);
  const [itemsByTable, setItemsByTable] = useState<Record<string, AccessoryCustomItem[]>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState<AccessoryCustomTable | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const { data: tableRows, error: tErr } = await supabase
      .from("accessory_custom_tables")
      .select("*, profiles:created_by(full_name)")
      .order("created_at", { ascending: true });

    if (tErr) {
      setLoadError(tErr.message);
      setTables([]);
      setItemsByTable({});
      setLoading(false);
      return;
    }

    const list = (tableRows as AccessoryCustomTable[]) ?? [];
    setTables(list);

    if (list.length === 0) {
      setItemsByTable({});
      setLoading(false);
      return;
    }

    const ids = list.map((t) => t.id);
    const { data: itemRows, error: iErr } = await supabase
      .from("accessory_custom_items")
      .select("*")
      .in("table_id", ids)
      .order("created_at", { ascending: true });

    if (iErr) {
      setLoadError(iErr.message);
      setItemsByTable({});
      setLoading(false);
      return;
    }

    const grouped: Record<string, AccessoryCustomItem[]> = {};
    for (const id of ids) grouped[id] = [];
    for (const row of (itemRows as AccessoryCustomItem[]) ?? []) {
      if (!grouped[row.table_id]) grouped[row.table_id] = [];
      grouped[row.table_id].push(row);
    }
    setItemsByTable(grouped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (userLoading || !profile) return;
    void refresh();
  }, [userLoading, profile, refresh]);

  async function handleCreateTable() {
    if (!canCreateCollection) {
      toast.error("You do not have permission to create collections.");
      return;
    }
    const name = newTableName.trim();
    if (!name || !profile?.id) {
      toast.error("Enter a collection name.");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("accessory_custom_tables").insert({
      name,
      created_by: profile.id,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Collection created");
    setNewTableName("");
    setCreateOpen(false);
    void refresh();
  }

  async function handleRename() {
    if (!canEditCollection) {
      toast.error("You do not have permission to rename collections.");
      return;
    }
    const t = renameTarget;
    const name = renameValue.trim();
    if (!t || !name) return;
    setRenaming(true);
    const { error } = await supabase
      .from("accessory_custom_tables")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", t.id);
    setRenaming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Collection renamed");
    setRenameTarget(null);
    void refresh();
  }

  async function handleDeleteTable(tableId: string) {
    if (!canDeleteCollection) {
      toast.error("You do not have permission to delete collections.");
      return;
    }
    const res = await fetch(`/api/accessory-collections/tables/${tableId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Delete failed");
      return;
    }
    toast.success("Collection removed");
    setPendingDelete(null);
    void refresh();
  }

  async function patchItem(
    id: string,
    patch: Partial<Pick<AccessoryCustomItem, "label" | "quantity" | "note" | "linked_plate">>
  ) {
    if (!canEditCollection) {
      toast.error("You do not have permission to edit lines.");
      return;
    }
    const { error } = await supabase
      .from("accessory_custom_items")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void refresh();
  }

  async function addItem(tableId: string) {
    if (!canEditCollection) {
      toast.error("You do not have permission to add lines.");
      return;
    }
    const { data, error } = await supabase
      .from("accessory_custom_items")
      .insert({
        table_id: tableId,
        label: "",
        quantity: 1,
        note: null,
        linked_plate: null,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Line added");
    void refresh();
  }

  async function deleteItem(id: string) {
    if (!canEditCollection) {
      toast.error("You do not have permission to remove lines.");
      return;
    }
    const res = await fetch(`/api/accessory-collections/items/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof j?.error === "string" ? j.error : "Delete failed");
      return;
    }
    toast.success("Line removed");
    void refresh();
  }

  if (userLoading || !profile) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading custom collections…
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-lg">Custom collections</CardTitle>
          <CardDescription className="text-amber-900 dark:text-amber-100">
            Could not load from Supabase: {loadError}. Apply migration{" "}
            <code className="rounded bg-muted px-1">035_accessory_custom_tables</code> if missing.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Custom collections</h2>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Create accessory lists for your team. Who can create, edit lines, rename, or delete a whole
            collection follows role permissions (owner-only delete of collections).
          </p>
        </div>
        {canCreateCollection ? (
          <Button type="button" className="gap-2 shrink-0" onClick={() => setCreateOpen(true)}>
            <Table2 className="size-4" />
            New collection
          </Button>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New collection</DialogTitle>
            <DialogDescription>
              Choose a short name (e.g. &quot;Winter kits&quot;, &quot;Promo stock&quot;). You can add rows after
              creating it.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Collection name"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleCreateTable()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={creating} onClick={() => void handleCreateTable()}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => {
          if (!o) setRenameTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename collection</DialogTitle>
            <DialogDescription>Updates the list title for all staff (requires edit permission).</DialogDescription>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button disabled={renaming} onClick={() => void handleRename()}>
              {renaming ? <Loader2 className="size-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this collection?</AlertDialogTitle>
            <AlertDialogDescription>
              All lines in &quot;{pendingDelete?.name}&quot; will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && void handleDeleteTable(pendingDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {tables.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No custom collections yet. Click <strong>New collection</strong> to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {tables.map((t) => {
            const items = itemsByTable[t.id] ?? [];
            const qtySum = items.reduce(
              (acc, r) => acc + (Number.isFinite(Number(r.quantity)) ? Number(r.quantity) : 0),
              0
            );
            return (
              <Card key={t.id} className="border-border/70 overflow-hidden shadow-sm">
                <CardHeader className="border-border/60 bg-muted/30 flex flex-row flex-wrap items-start justify-between gap-3 border-b py-4">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg">{t.name}</CardTitle>
                    <CardDescription>
                      {items.length} line{items.length === 1 ? "" : "s"} · Qty sum {qtySum}
                      {profileName(t) ? ` · Created by ${profileName(t)}` : ""}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canEditCollection ? (
                      <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => void addItem(t.id)}>
                        <Plus className="size-4" />
                        Add line
                      </Button>
                    ) : null}
                    {(canEditCollection || canDeleteCollection) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="outline" size="icon" aria-label="Collection actions">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canEditCollection ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameTarget(t);
                                setRenameValue(t.name);
                              }}
                            >
                              <Pencil className="mr-2 size-4" />
                              Rename
                            </DropdownMenuItem>
                          ) : null}
                          {canDeleteCollection ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setPendingDelete({ id: t.id, name: t.name })}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete collection
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="min-w-[200px] pl-6">Label</TableHead>
                          <TableHead className="w-[100px]">Qty</TableHead>
                          <TableHead className="min-w-[180px]">Note</TableHead>
                          <TableHead className="min-w-[160px]">Linked plate</TableHead>
                          <TableHead className="w-[72px] pr-6 text-right"> </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                              No lines yet — use Add line.
                            </TableCell>
                          </TableRow>
                        ) : (
                          items.map((row) => (
                            <TableRow key={row.id} className="group">
                              <TableCell className="pl-6 align-top">
                                <Input
                                  defaultValue={row.label}
                                  key={`${row.id}-label-${row.updated_at}`}
                                  onBlur={(e) => {
                                    if (e.target.value !== row.label) {
                                      void patchItem(row.id, { label: e.target.value });
                                    }
                                  }}
                                  placeholder="Label"
                                  className="bg-background/80 h-9 max-w-md border-transparent shadow-none focus-visible:border-input"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step={1}
                                  defaultValue={String(row.quantity)}
                                  key={`${row.id}-qty-${row.updated_at}`}
                                  onBlur={(e) => {
                                    const v = parseFloat(e.target.value);
                                    const q = Number.isFinite(v) ? v : 0;
                                    if (q !== Number(row.quantity)) void patchItem(row.id, { quantity: q });
                                  }}
                                  className="bg-background/80 h-9 w-full min-w-[4.5rem] border-transparent shadow-none focus-visible:border-input"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  defaultValue={row.note ?? ""}
                                  key={`${row.id}-note-${row.updated_at}`}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim() === "" ? null : e.target.value;
                                    if (v !== row.note) void patchItem(row.id, { note: v });
                                  }}
                                  placeholder="Optional"
                                  className="bg-background/80 h-9 max-w-xl border-transparent shadow-none focus-visible:border-input"
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  defaultValue={row.linked_plate ?? ""}
                                  key={`${row.id}-lp-${row.updated_at}`}
                                  onBlur={(e) => {
                                    const v = e.target.value.trim() === "" ? null : e.target.value;
                                    if (v !== (row.linked_plate ?? null)) {
                                      void patchItem(row.id, { linked_plate: v });
                                    }
                                  }}
                                  placeholder="Optional"
                                  className="bg-background/80 h-9 max-w-xs border-transparent shadow-none focus-visible:border-input"
                                />
                              </TableCell>
                              <TableCell className="pr-6 text-right align-top">
                                {canEditCollection ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive size-9 opacity-70 group-hover:opacity-100"
                                    onClick={() => void deleteItem(row.id)}
                                    aria-label="Remove row"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
