"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { JobPriority } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";

interface CarOption {
  id: string;
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
  exterior_color: string | null;
  status: string;
}

interface PartToAdd {
  part_id: string;
  part_name: string;
  oe_number: string | null;
  quantity: number;
  note: string;
}

interface NewJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedCar?: CarOption | null;
}

const ASSIGN_OPTIONS = ["Mark", "External Mechanic"];

export function NewJobDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedCar,
}: NewJobDialogProps) {
  const [carSearch, setCarSearch] = useState("");
  const [cars, setCars] = useState<CarOption[]>([]);
  const [selectedCar, setSelectedCar] = useState<CarOption | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [notes, setNotes] = useState("");
  const [partsToAdd, setPartsToAdd] = useState<PartToAdd[]>([]);
  const [allParts, setAllParts] = useState<{ id: string; part_name: string; oe_number: string | null }[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);
  const [partQuantity, setPartQuantity] = useState("1");
  const [partNote, setPartNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanVinOpen, setScanVinOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!open) {
      setCarSearch("");
      setCars([]);
      setSelectedCar(null);
    } else if (preselectedCar) {
      setSelectedCar(preselectedCar);
    }
  }, [open, preselectedCar]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setPriority("normal");
      setAssignedTo("");
      setDueDate("");
      setEstimatedHours("");
      setNotes("");
      setPartsToAdd([]);
      setAllParts([]);
      setPartQuantity("1");
      setPartNote("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !carSearch.trim() || carSearch.length < 2) {
      setCars([]);
      return;
    }
    const q = carSearch.trim();
    const client = createClient();
    client
      .from("cars")
      .select("id, vin, brand, model, model_year, exterior_color, status")
      .is("deleted_at", null)
      .or(`vin.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`)
      .limit(10)
      .then(({ data }) => setCars((data as CarOption[]) ?? []));
  }, [carSearch, open]);

  useEffect(() => {
    if (!open) return;
    setPartsLoading(true);
    supabase
      .from("parts")
      .select("id, part_name, oe_number")
      .is("deleted_at", null)
      .order("part_name", { ascending: true })
      .then(({ data }) => {
        setAllParts(
          (data as { id: string; part_name: string; oe_number: string | null }[]) ?? []
        );
        setPartsLoading(false);
      });
  }, [open]);

  function addPart(partId: string, partName: string, oeNumber: string | null) {
    const qty = parseInt(partQuantity, 10);
    if (isNaN(qty) || qty < 1) {
      toast.error("Enter valid quantity");
      return;
    }
    if (partsToAdd.some((p) => p.part_id === partId)) {
      toast.error("Part already added");
      return;
    }
    setPartsToAdd((prev) => [
      ...prev,
      { part_id: partId, part_name: partName, oe_number: oeNumber, quantity: qty, note: partNote.trim() },
    ]);
    setPartQuantity("1");
    setPartNote("");
  }

  function removePart(partId: string) {
    setPartsToAdd((prev) => prev.filter((p) => p.part_id !== partId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCar) {
      toast.error("Please select a car");
      return;
    }
    if (!title.trim()) {
      toast.error("Job title is required");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSubmitting(false);
      return;
    }

    const { data: jobData, error: jobError } = await supabase
      .from("garage_jobs")
      .insert({
        car_id: selectedCar.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: "pending",
        assigned_to: assignedTo.trim() || null,
        due_date: dueDate || null,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (jobError) {
      toast.error(jobError.message);
      setSubmitting(false);
      return;
    }

    const { data: carData } = await supabase
      .from("cars")
      .select("status")
      .eq("id", selectedCar.id)
      .single();

    const currentStatus = (carData as { status?: string } | null)?.status ?? "in_stock";

    await supabase
      .from("cars")
      .update({ status: "service" })
      .eq("id", selectedCar.id);

    await supabase.from("car_events").insert({
      car_id: selectedCar.id,
      event_type: "status_changed",
      from_value: currentStatus,
      to_value: "service",
      note: `Garage job created: ${title.trim()}`,
      created_by: user.id,
    });

    const jobId = (jobData as { id: string }).id;
    for (const p of partsToAdd) {
      const { error } = await supabase.rpc("use_part_on_job", {
        p_job_id: jobId,
        p_part_id: p.part_id,
        p_quantity: p.quantity,
        p_note: p.note || null,
        p_user_id: user.id,
      });
      if (error) {
        toast.error(`Failed to add part ${p.part_name}: ${error.message}`);
      }
    }

    toast.success(partsToAdd.length > 0 ? "Job created with parts" : "Job created");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] max-w-[500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">New Garage Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-base">🚗 Select Car *</Label>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Search by VIN, brand, or model..."
                value={carSearch}
                onChange={(e) => setCarSearch(e.target.value)}
                className="h-11 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setScanVinOpen(true)}
                title="Scan VIN"
                className="h-11 w-11 shrink-0"
              >
                <ScanLine className="size-4" />
              </Button>
            </div>
            {selectedCar ? (
              <div
                className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-2 border-primary bg-primary/5 p-3"
                onClick={() => setSelectedCar(null)}
              >
                <span className="font-mono text-sm">
                  {selectedCar.vin} · {selectedCar.brand} {selectedCar.model}
                  {selectedCar.exterior_color ? ` · ${selectedCar.exterior_color}` : ""}
                </span>
                <span className="text-muted-foreground text-xs">Clear</span>
              </div>
            ) : (
              cars.length > 0 && (
                <div className="mt-2 space-y-1">
                  {cars.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => {
                        setSelectedCar(c);
                        setCarSearch("");
                        setCars([]);
                      }}
                    >
                      <span className="font-mono text-sm">
                        {c.vin} · {c.brand} {c.model}
                        {c.exterior_color ? ` · ${c.exterior_color}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>

          <div>
            <Label className="text-base">📝 Job Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brake Pad Replacement"
              className="mt-2 h-11"
              required
            />
          </div>

          <div>
            <Label className="text-base">📋 Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Customer complaint..."
              rows={3}
              className="mt-2"
            />
          </div>

          <div>
            <Label className="text-base">⚡ Priority</Label>
            <div className="mt-2 flex gap-2">
              {(["low", "normal", "urgent"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                    priority === p
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {p === "low" ? "Low" : p === "normal" ? "Normal" : "Urgent"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-base">👤 Assign To</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ASSIGN_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAssignedTo(opt)}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    assignedTo === opt ? "border-primary bg-primary/10" : ""
                  }`}
                >
                  {opt}
                </button>
              ))}
              <Input
                placeholder="Or type name..."
                value={ASSIGN_OPTIONS.includes(assignedTo) ? "" : assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-36"
              />
            </div>
          </div>

          <div>
            <Label className="text-base">📅 Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-2 h-11"
            />
          </div>

          <div>
            <Label className="text-base">⏱️ Estimated Hours</Label>
            <Input
              type="number"
              step="0.5"
              min={0}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="2"
              className="mt-2 h-11"
            />
          </div>

          <div>
            <Label className="text-base">🔧 Part Numbers Used</Label>
            <p className="mt-1 text-muted-foreground text-sm">
              Click parts to add them — you can add multiple parts. Set quantity and note before each add.
            </p>
            <div className="mt-2 flex gap-2">
              <Input
                type="number"
                min={1}
                value={partQuantity}
                onChange={(e) => setPartQuantity(e.target.value)}
                placeholder="Qty"
                className="h-9 w-20"
              />
              <Input
                value={partNote}
                onChange={(e) => setPartNote(e.target.value)}
                placeholder="Note (optional)"
                className="h-9 flex-1"
              />
            </div>
            {partsLoading ? (
              <p className="mt-2 text-muted-foreground text-sm">Loading parts...</p>
            ) : allParts.length === 0 ? (
              <p className="mt-2 text-muted-foreground text-sm">
                No parts in inventory. Add parts in Parts Inventory first.
              </p>
            ) : (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">
                {allParts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPart(p.id, p.part_name, p.oe_number)}
                    disabled={partsToAdd.some((a) => a.part_id === p.id)}
                    className={`flex w-full justify-between border-b p-2 text-left text-sm last:border-b-0 ${
                      partsToAdd.some((a) => a.part_id === p.id)
                        ? "cursor-not-allowed bg-muted/50 text-muted-foreground"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span>{p.part_name}</span>
                    <span className="font-mono text-muted-foreground">
                      {p.oe_number ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {allParts.length > 0 && partsToAdd.length === 0 ? (
              <p className="mt-2 text-muted-foreground text-sm">
                No parts added yet. Click parts from the list above to add one or more.
              </p>
            ) : partsToAdd.length > 0 ? (
              <div className="mt-2 space-y-2">
                {partsToAdd.map((p) => (
                  <div
                    key={p.part_id}
                    className="flex items-center justify-between rounded-lg border p-2 text-sm"
                  >
                    <span>
                      {p.part_name}
                      {p.oe_number && (
                        <span className="ml-2 font-mono text-muted-foreground">
                          {p.oe_number}
                        </span>
                      )}
                      <span className="ml-2 text-muted-foreground">× {p.quantity}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePart(p.part_id)}
                      className="h-8 w-8 p-0 text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <Label className="text-base">📝 Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-2"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="h-11 px-6">
              {submitting ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ScannerDialog
        open={scanVinOpen}
        onClose={() => setScanVinOpen(false)}
        onScan={(value) => {
          setCarSearch(value.toUpperCase());
          setScanVinOpen(false);
        }}
        title="Scan VIN"
        placeholder="17-character VIN..."
        scanType="vin"
      />
    </Dialog>
  );
}
