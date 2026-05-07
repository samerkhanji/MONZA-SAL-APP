"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { Part } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { formatError } from "@/lib/error-messages";

interface CarOption {
  id: string;
  vin: string;
  brand: string;
  model: string;
}

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  part: Part | null;
  movementType: "stock_in" | "stock_out";
  onSuccess: () => void;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  part,
  movementType,
  onSuccess,
}: StockMovementDialogProps) {
  const [quantity, setQuantity] = useState("");
  const [carId, setCarId] = useState<string | null>(null);
  const [carSearch, setCarSearch] = useState("");
  const [cars, setCars] = useState<CarOption[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanVinOpen, setScanVinOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (open) {
      setQuantity("");
      setCarId(null);
      setCarSearch("");
      setCars([]);
      setJobDescription("");
      setNote("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !carSearch.trim() || carSearch.length < 2) {
      setCars([]);
      return;
    }
    const q = carSearch.trim();
    const client = createClient();
    (async () => {
      const { data } = await client
        .from("cars")
        .select("id, vin, brand, model")
        .is("deleted_at", null)
        .or(`vin.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`)
        .limit(10);
      setCars((data as CarOption[]) ?? []);
    })();
  }, [carSearch, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!part) return;
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (movementType === "stock_out" && qty > part.quantity) {
      toast.error("Quantity exceeds current stock");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.rpc("move_part_stock", {
      p_part_id: part.id,
      p_movement_type: movementType,
      p_quantity: qty,
      p_car_id: carId || null,
      p_job_description: jobDescription.trim() || null,
      p_note: note.trim() || null,
      p_user_id: user?.id ?? null,
    });

    setSubmitting(false);

    if (error) {
      toast.error(formatError(error));
      return;
    }

    toast.success(
      movementType === "stock_in"
        ? `Added ${qty} to stock`
        : `Removed ${qty} from stock`
    );
    onOpenChange(false);
    onSuccess();
  }

  const title =
    movementType === "stock_in"
      ? `Stock In: ${part?.part_name ?? ""}`
      : `Stock Out: ${part?.part_name ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {part && (
            <p className="text-muted-foreground text-sm">
              Current stock: {part.quantity}
            </p>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="stock-movement-quantity"
              name="stock-movement-quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          {movementType === "stock_out" && (
            <>
              <div>
                <Label>Link to Car (VIN)</Label>
                <div className="flex gap-2">
                  <Input
                    id="stock-movement-car-search"
                    name="stock-movement-car-search"
                    placeholder="Search by VIN, brand, model..."
                    value={carSearch}
                    onChange={(e) => setCarSearch(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setScanVinOpen(true)}
                    title="Scan VIN"
                    className="shrink-0"
                  >
                    <ScanLine className="size-4" />
                  </Button>
                </div>
                {cars.length > 0 && (
                  <Select
                    value={carId ?? "_"}
                    onValueChange={(v) => setCarId(v === "_" ? null : v)}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select car (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_">— None —</SelectItem>
                      {cars.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.vin} — {c.brand} {c.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="job_description">Job Description</Label>
                <Input
                  id="stock-movement-job-description"
                  name="stock-movement-job-description"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="e.g. Brake pad replacement"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="stock-movement-note"
              name="stock-movement-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                movementType === "stock_in"
                  ? "e.g. New shipment from supplier"
                  : "e.g. Front axle"
              }
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Processing..." : "Confirm"}
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
