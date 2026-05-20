"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { formatError } from "@/lib/error-messages";

interface Supplier {
  id: string;
  name: string;
  kind: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

interface POStat {
  supplier_id: string;
  total_pos: number;
  active_pos: number;
  spend_total: number;
  currency: string;
}

const KIND_OPTIONS = [
  { value: "parts", label: "Parts" },
  { value: "vehicle", label: "Vehicle / Dongfeng" },
  { value: "accessory", label: "Accessory" },
  { value: "service", label: "Service / outsourcing" },
  { value: "supplies", label: "Office / shop supplies" },
  { value: "other", label: "Other" },
];

const fmt = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);

export default function SuppliersPage() {
  const { isOwner, hasCapability } = useUser();
  const canRead =
    isOwner ||
    hasCapability("inventory") ||
    hasCapability("garage") ||
    hasCapability("cashier") ||
    hasCapability("manage_team");

  if (!canRead) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        <AlertTriangle className="mx-auto mb-3 size-6" />
        <p>You don&apos;t have access to suppliers.</p>
        <Button variant="link" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }
  return <Body />;
}

function Body() {
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canWrite = isOwner || hasCapability("inventory") || hasCapability("garage");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stats, setStats] = useState<Record<string, POStat>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [sup, pos] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, name, kind, contact_person, email, phone, address, notes, created_at")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase
        .from("purchase_orders")
        .select("supplier_id, status, estimated_total, currency")
        .is("deleted_at", null)
        .not("supplier_id", "is", null),
    ]);
    if (sup.error) toast.error(formatError(sup.error));
    else setSuppliers((sup.data as Supplier[]) ?? []);

    if (pos.error) {
      toast.error(formatError(pos.error));
    } else {
      const m: Record<string, POStat> = {};
      ((pos.data ?? []) as Array<{ supplier_id: string; status: string; estimated_total: number; currency: string }>).forEach(
        (p) => {
          const k = p.supplier_id;
          if (!m[k]) m[k] = { supplier_id: k, total_pos: 0, active_pos: 0, spend_total: 0, currency: p.currency ?? "USD" };
          m[k].total_pos += 1;
          if (!["paid", "cancelled", "rejected"].includes(p.status)) m[k].active_pos += 1;
          if (p.status === "paid") m[k].spend_total += Number(p.estimated_total ?? 0);
        }
      );
      setStats(m);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        (s.contact_person ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.kind ?? "").toLowerCase().includes(q)
      );
    });
  }, [suppliers, search]);

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-muted-foreground text-sm">
            Companies and people Monza buys from. Each row links to the
            supplier&apos;s purchase order history.
          </p>
        </div>
        {canWrite && (
          <Button data-tour-id="suppliers-new" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" /> New supplier
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          data-tour-id="suppliers-search"
          placeholder="Search by name, contact, email, phone, kind…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card data-tour-id="suppliers-table">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {suppliers.length === 0
                ? "No suppliers yet. Add one to start creating purchase orders."
                : "No suppliers match your search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Phone / Email</th>
                    <th className="px-3 py-2 text-right">POs</th>
                    <th className="px-3 py-2 text-right">Active</th>
                    <th className="px-3 py-2 text-right">Paid total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((s) => {
                    const st = stats[s.id];
                    return (
                      <tr key={s.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2">
                          {s.kind ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                              {KIND_OPTIONS.find((k) => k.value === s.kind)?.label ?? s.kind}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {s.contact_person ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div className="flex flex-col gap-0.5 text-xs">
                            {s.phone && (
                              <a href={`tel:${s.phone}`} className="flex items-center gap-1 hover:underline">
                                <Phone className="size-3" /> {s.phone}
                              </a>
                            )}
                            {s.email && (
                              <a href={`mailto:${s.email}`} className="flex items-center gap-1 hover:underline">
                                <Mail className="size-3" /> {s.email}
                              </a>
                            )}
                            {!s.phone && !s.email && "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{st?.total_pos ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {st?.active_pos ? (
                            <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                              {st.active_pos}
                            </Badge>
                          ) : (
                            "0"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {st ? fmt(st.spend_total, st.currency) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              data-tour-id="suppliers-view-pos"
                              variant="ghost"
                              size="icon-xs"
                              asChild
                              title="View purchase orders"
                            >
                              <Link
                                href={`/garage/purchase-orders?supplier=${s.id}`}
                              >
                                <ExternalLink className="size-3.5" />
                              </Link>
                            </Button>
                            {canWrite && (
                              <Button
                                data-tour-id="suppliers-edit"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setEditing(s)}
                                title="Edit"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            )}
                            {isOwner && (
                              <Button
                                data-tour-id="suppliers-delete"
                                variant="ghost"
                                size="icon-xs"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setConfirmDelete(s)}
                                title="Soft-delete"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
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

      <SupplierDialog
        open={addOpen || editing !== null}
        editing={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onDone={() => {
          setAddOpen(false);
          setEditing(null);
          void load();
        }}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.name ?? "this supplier"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The supplier is hidden from new purchase orders but existing POs
              keep the reference. You can restore later via the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                const { error } = await supabase
                  .from("suppliers")
                  .update({ deleted_at: new Date().toISOString() })
                  .eq("id", confirmDelete.id);
                if (error) {
                  toast.error(formatError(error));
                  return;
                }
                toast.success("Supplier removed");
                setConfirmDelete(null);
                void load();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="text-muted-foreground flex items-center justify-between pt-2 text-xs">
        <Button data-tour-id="suppliers-purchase-orders-link" variant="link" size="sm" asChild>
          <Link href="/garage/purchase-orders">
            <ArrowLeft className="mr-1 size-3" /> Purchase orders
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SupplierDialog({
  open,
  editing,
  onClose,
  onDone,
}: {
  open: boolean;
  editing: Supplier | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("parts");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name ?? "");
      setKind(editing.kind ?? "parts");
      setContactPerson(editing.contact_person ?? "");
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setAddress(editing.address ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setKind("parts");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setAddress("");
      setNotes("");
    }
  }, [open, editing]);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      name: name.trim(),
      kind: kind || null,
      contact_person: contactPerson.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };
    let error;
    if (editing) {
      const { error: e } = await supabase
        .from("suppliers")
        .update(payload)
        .eq("id", editing.id);
      error = e;
    } else {
      const { error: e } = await supabase
        .from("suppliers")
        .insert({ ...payload, created_by: u?.user?.id ?? null });
      error = e;
    }
    setSubmitting(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(editing ? "Supplier updated" : "Supplier added");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-tour-id="suppliers-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>
            Used in purchase orders. You can edit details later — POs keep
            their original reference even if a name changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contact person</Label>
              <Input
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+961 …"
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment terms, lead times, preferences, anything to remember"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={submitting || !name.trim()}>
            {submitting ? "Saving…" : editing ? "Save" : "Add supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
