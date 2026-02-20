"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
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
import { ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";

interface AddPartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddPartDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddPartDialogProps) {
  const [partName, setPartName] = useState("");
  const [oeNumber, setOeNumber] = useState("");
  const [carModel, setCarModel] = useState("");
  const [description, setDescription] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [minQuantity, setMinQuantity] = useState("2");
  const [storageZone, setStorageZone] = useState("");
  const [supplier, setSupplier] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanPartOpen, setScanPartOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (open) {
      setPartName("");
      setOeNumber("");
      setCarModel("");
      setDescription("");
      setInitialQuantity("0");
      setMinQuantity("2");
      setStorageZone("");
      setSupplier("");
      setOrderDate("");
      setNotes("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partName.trim()) {
      toast.error("Part name is required");
      return;
    }
    const qty = parseInt(initialQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error("Invalid quantity");
      return;
    }
    const minQty = parseInt(minQuantity, 10);
    if (isNaN(minQty) || minQty < 0) {
      toast.error("Invalid min quantity");
      return;
    }

    setSubmitting(true);
    const { data: authUser } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("parts")
      .insert({
        part_name: partName.trim(),
        oe_number: oeNumber.trim() || null,
        car_model: carModel.trim() || null,
        description: description.trim() || null,
        quantity: qty,
        min_quantity: minQty,
        storage_zone: storageZone.trim() || null,
        supplier: supplier.trim() || null,
        unit_cost: null,
        currency: "USD",
        order_date: orderDate || null,
        notes: notes.trim() || null,
        created_by: authUser.user?.id ?? null,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Part added successfully");
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,92dvh)] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Part</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="part_name">Part Name *</Label>
              <Input
                id="part-name"
                name="part-name"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                placeholder="e.g. Brake Pads Front Set"
                required
              />
            </div>
            <div>
              <Label htmlFor="oe_number">OE Number</Label>
              <div className="flex gap-2">
                <Input
                  id="part-oe-number"
                  name="part-oe-number"
                  value={oeNumber}
                  onChange={(e) => setOeNumber(e.target.value)}
                  placeholder="e.g. ABC123"
                  className="font-mono flex-1"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScanPartOpen(true)}
                  title="Scan Part Number"
                  className="shrink-0"
                >
                  <ScanLine className="size-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="car_model">Car Model</Label>
              <Input
                id="part-car-model"
                name="part-car-model"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                placeholder="e.g. General, Voyah Passion, MHero"
                autoComplete="off"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="part-description"
                name="part-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="initial_quantity">Initial Quantity *</Label>
              <Input
                id="part-initial-quantity"
                name="part-initial-quantity"
                type="number"
                min={0}
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
                required
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="min_quantity">Min Quantity</Label>
              <Input
                id="part-min-quantity"
                name="part-min-quantity"
                type="number"
                min={0}
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="storage_zone">Storage Zone</Label>
              <Input
                id="part-storage-zone"
                name="part-storage-zone"
                value={storageZone}
                onChange={(e) => setStorageZone(e.target.value)}
                placeholder="e.g. A1-B2"
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="part-supplier"
                name="part-supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="order_date">Arrived Date</Label>
              <Input
                id="part-order-date"
                name="part-order-date"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="part-notes"
                name="part-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                autoComplete="off"
              />
            </div>
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
              {submitting ? "Adding..." : "Add Part"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ScannerDialog
        open={scanPartOpen}
        onClose={() => setScanPartOpen(false)}
        onScan={(value) => {
          setOeNumber(value.trim());
          setScanPartOpen(false);
        }}
        title="Scan Part OE Number"
        placeholder="Part OE number..."
        scanType="part"
      />
    </Dialog>
  );
}
