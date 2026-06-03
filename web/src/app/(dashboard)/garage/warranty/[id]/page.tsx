"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

interface WarrantyCase {
  id: string;
  case_number: string;
  car_id: string;
  customer_id: string | null;
  job_id: string | null;
  recall_id: string | null;
  kind: string;
  severity: string;
  status: string;
  summary: string;
  notes: string | null;
  resolution: string | null;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
}

interface CasePart {
  id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number | null;
  notes: string | null;
  created_at: string;
}

interface CaseDoc {
  id: string;
  storage_path: string;
  filename: string;
  kind: string;
  caption: string | null;
  created_at: string;
}

interface CarLite {
  id: string;
  vin: string | null;
  model: string | null;
  model_year: number | null;
  customer_id: string | null;
}

interface CustomerLite { id: string; full_name?: string | null; name?: string | null; }
interface PartLite { id: string; name: string; }

const STATUS_OPTS = ["open","investigating","awaiting_parts","in_repair","completed","rejected","cancelled"];

const STATUS_COLOR: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  investigating: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  awaiting_parts: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  in_repair: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-muted text-foreground",
};

export default function WarrantyDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const router = useRouter();
  const supabase = createClient();
  const { isOwner, hasCapability } = useUser();
  const canWrite = isOwner || hasCapability("garage");

  const [wc, setWc] = useState<WarrantyCase | null>(null);
  const [car, setCar] = useState<CarLite | null>(null);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [caseParts, setCaseParts] = useState<CasePart[]>([]);
  const [caseDocs, setCaseDocs] = useState<CaseDoc[]>([]);
  const [parts, setParts] = useState<PartLite[]>([]);
  const [loading, setLoading] = useState(true);

  const [partDescription, setPartDescription] = useState("");
  const [partQuantity, setPartQuantity] = useState("1");
  const [partSelectedId, setPartSelectedId] = useState<string>("");
  const [partUnitCost, setPartUnitCost] = useState("");
  const [partsBusy, setPartsBusy] = useState(false);

  const [resolution, setResolution] = useState("");
  const [savingResolution, setSavingResolution] = useState(false);
  const [deletePartId, setDeletePartId] = useState<string | null>(null);

  const load = useCallback(async () => {
    // `loading` starts true for the first render (skeleton). Don't flip it back
    // on post-mutation refetches — that unmounts the page to the skeleton (the
    // "white screen flash" after Add part / delete / save).
    const [w, p, d, allParts] = await Promise.all([
      supabase.from("warranty_cases").select("*").eq("id", id).is("deleted_at", null).single(),
      supabase.from("warranty_case_parts").select("*").eq("case_id", id).order("created_at"),
      supabase.from("warranty_case_documents").select("*").eq("case_id", id).order("created_at", { ascending: false }),
      supabase.from("parts").select("id, name:part_name").limit(2000),
    ]);
    if (w.error) {
      toast.error(formatError(w.error));
      setLoading(false);
      return;
    }
    const c = w.data as WarrantyCase;
    setWc(c);
    setResolution(c.resolution ?? "");
    if (c.car_id) {
      const { data: car } = await supabase.from("cars").select("id, vin, model, model_year, customer_id").eq("id", c.car_id).single();
      setCar((car as CarLite | null) ?? null);
    }
    if (c.customer_id) {
      const { data: cu } = await supabase.from("customers_display").select("id, full_name").eq("id", c.customer_id).single();
      setCustomer((cu as CustomerLite | null) ?? null);
    }
    setCaseParts((p.data as CasePart[]) ?? []);
    setCaseDocs((d.data as CaseDoc[]) ?? []);
    setParts((allParts.data as PartLite[]) ?? []);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(next: string) {
    if (!wc) return;
    const { error } = await supabase.rpc("set_warranty_case_status", {
      p_case_id: wc.id,
      p_status: next,
    });
    if (error) return toast.error(formatError(error));
    toast.success(`Status set to ${next.replace(/_/g, " ")}`);
    void load();
  }

  async function addPart() {
    if (!wc) return;
    if (!partDescription.trim()) return toast.error("Description is required");
    const q = Number(partQuantity);
    if (!Number.isFinite(q) || q <= 0) return toast.error("Quantity must be > 0");
    setPartsBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("warranty_case_parts").insert({
      case_id: wc.id,
      part_id: partSelectedId || null,
      description: partDescription.trim(),
      quantity: q,
      unit_cost: partUnitCost ? Number(partUnitCost) : null,
      created_by: u?.user?.id ?? null,
    });
    setPartsBusy(false);
    if (error) return toast.error(formatError(error));
    setPartDescription("");
    setPartQuantity("1");
    setPartSelectedId("");
    setPartUnitCost("");
    void load();
  }

  async function removePart(pid: string) {
    const { error } = await supabase.from("warranty_case_parts").delete().eq("id", pid);
    if (error) return toast.error(formatError(error));
    void load();
  }

  async function saveResolution() {
    if (!wc) return;
    // Guard against clobbering a previously-saved resolution with an empty one.
    if (!resolution.trim()) {
      toast.error("Resolution cannot be empty");
      return;
    }
    setSavingResolution(true);
    const { error } = await supabase.from("warranty_cases").update({ resolution: resolution.trim() }).eq("id", wc.id);
    setSavingResolution(false);
    if (error) return toast.error(formatError(error));
    toast.success("Resolution saved");
  }

  async function uploadDocs(files: FileList | null) {
    if (!wc || !files || files.length === 0) return;
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id ?? null;
    for (const file of Array.from(files)) {
      const path = `warranty/${wc.id}/${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("job-documents").upload(path, file);
      if (up.error) {
        toast.error(`Upload failed: ${up.error.message}`);
        continue;
      }
      const isImage = file.type.startsWith("image/");
      const { error } = await supabase.from("warranty_case_documents").insert({
        case_id: wc.id,
        storage_path: path,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        kind: isImage ? "photo" : "document",
        created_by: uid,
      });
      if (error) toast.error(formatError(error));
    }
    void load();
  }

  if (loading) {
    return (
      <div className="container space-y-3 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!wc) {
    return (
      <div className="container py-12 text-center text-muted-foreground">
        Case not found.
        <div className="mt-3">
          <Button variant="link" asChild>
            <Link href="/garage/warranty"><ArrowLeft className="mr-1 size-3" /> Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/garage/warranty" className="text-muted-foreground inline-flex items-center text-xs hover:underline">
            <ArrowLeft className="mr-1 size-3" /> Warranty cases
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{wc.case_number}</h1>
          <p className="text-muted-foreground text-sm">{wc.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("h-6 px-2 text-[11px] uppercase", STATUS_COLOR[wc.status] ?? "")}>
            {wc.status.replace(/_/g, " ")}
          </Badge>
          {canWrite && (
            <Select value={wc.status} onValueChange={(v) => void changeStatus(v)}>
              <SelectTrigger data-tour-id="warranty-detail-status" className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTS.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Card data-tour-id="warranty-detail-summary">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground text-xs uppercase">VIN / vehicle</Label>
            <p className="font-mono">{car?.vin ?? "—"}</p>
            <p className="text-muted-foreground text-sm">{[car?.model_year, car?.model].filter(Boolean).join(" ")}</p>
            {car && (
              <Link href={`/cars/${car.id}`} className="text-xs text-sky-600 hover:underline">View car details</Link>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Customer</Label>
            <p>{customer ? (customer.full_name ?? customer.name ?? "—") : "—"}</p>
            {customer && (
              <Link href={`/customers/${customer.id}`} className="text-xs text-sky-600 hover:underline">View customer</Link>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Kind</Label>
            <p className="capitalize">{wc.kind.replace("_", " ")}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs uppercase">Opened</Label>
            <p>{new Date(wc.opened_at).toLocaleString()}</p>
          </div>
          {wc.job_id && (
            <div>
              <Label className="text-muted-foreground text-xs uppercase">Garage job</Label>
              <Link href={`/garage/jobs/${wc.job_id}`} className="text-sky-600 hover:underline">View linked job</Link>
            </div>
          )}
          {wc.notes && (
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground text-xs uppercase">Notes</Label>
              <p className="text-muted-foreground whitespace-pre-wrap text-sm">{wc.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour-id="warranty-detail-parts">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Parts used / claimed</h2>
            <span className="text-muted-foreground text-xs">{caseParts.length} line{caseParts.length === 1 ? "" : "s"}</span>
          </div>
          {caseParts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No parts logged yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1.5">Description</th>
                  <th className="py-1.5">Linked part</th>
                  <th className="py-1.5 text-right">Qty</th>
                  <th className="py-1.5 text-right">Unit cost</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {caseParts.map((p) => {
                  const linked = p.part_id ? parts.find((x) => x.id === p.part_id) : null;
                  return (
                    <tr key={p.id}>
                      <td className="py-1.5">{p.description}</td>
                      <td className="py-1.5 text-muted-foreground">{linked?.name ?? "—"}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.quantity}</td>
                      <td className="py-1.5 text-right tabular-nums">{p.unit_cost != null ? Number(p.unit_cost).toFixed(2) : "—"}</td>
                      <td className="py-1.5 text-right">
                        {canWrite && (
                          <Button variant="ghost" size="icon-xs" onClick={() => setDeletePartId(p.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {canWrite && (
            <div className="bg-muted/30 grid gap-2 rounded-md border p-3 sm:grid-cols-4">
              <Input placeholder="Description *" value={partDescription} onChange={(e) => setPartDescription(e.target.value)} className="sm:col-span-2" />
              <Select value={partSelectedId} onValueChange={setPartSelectedId}>
                <SelectTrigger><SelectValue placeholder="Linked part (optional)" /></SelectTrigger>
                <SelectContent>
                  {parts.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" min="1" placeholder="Qty" value={partQuantity} onChange={(e) => setPartQuantity(e.target.value)} />
                <Input type="number" min="0" step="0.01" placeholder="Unit $" value={partUnitCost} onChange={(e) => setPartUnitCost(e.target.value)} />
              </div>
              <div className="sm:col-span-4 flex justify-end">
                <Button size="sm" onClick={() => void addPart()} disabled={partsBusy || !partDescription.trim()}>
                  <Plus className="mr-1 size-3.5" /> Add part
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour-id="warranty-detail-documents">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Photos &amp; documents</h2>
            <span className="text-muted-foreground text-xs">{caseDocs.length} file{caseDocs.length === 1 ? "" : "s"}</span>
          </div>
          {caseDocs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No files attached yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {caseDocs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <span>{d.kind === "photo" ? "🖼" : "📄"} {d.filename}</span>
                  <span className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
          {canWrite && (
            <div>
              <Label htmlFor="wc-files" className="text-muted-foreground text-xs uppercase">Upload</Label>
              <Input id="wc-files" type="file" multiple onChange={(e) => void uploadDocs(e.target.files)} />
              <p className="text-muted-foreground mt-1 text-xs">
                Photos and PDFs are attached privately to this case.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour-id="warranty-detail-resolution">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Resolution</h2>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
            placeholder="What was done? What was claimed back from the manufacturer? Etc."
            disabled={!canWrite}
          />
          {canWrite && (
            <div className="flex items-center justify-between">
              <Button size="sm" onClick={() => void saveResolution()} disabled={savingResolution || !resolution.trim()}>
                {savingResolution ? "Saving…" : "Save resolution"}
              </Button>
              {/* Refunds.customer_id is NOT NULL, so the deep-link only makes
                  sense when this warranty case has a customer attached.
                  Without one, the dialog opens but the customer field is
                  empty and the user has to pick one by hand — confusing
                  enough that we just hide the button until the data is
                  linked, with a hint pointing to the fix. */}
              {wc.customer_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/garage/refunds?warranty_case=${wc.id}&customer=${wc.customer_id}`
                    )
                  }
                >
                  Issue refund tied to this case
                </Button>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Link a customer to this case to issue a tied refund.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deletePartId !== null}
        onOpenChange={(v) => !v && setDeletePartId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this part from the case?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const ln = caseParts.find((x) => x.id === deletePartId);
                return ln
                  ? `"${ln.description}" (qty ${ln.quantity}) will be removed from this warranty case.`
                  : "This part line will be removed from this warranty case.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const target = deletePartId;
                setDeletePartId(null);
                if (target) void removePart(target);
              }}
            >
              Remove part
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
