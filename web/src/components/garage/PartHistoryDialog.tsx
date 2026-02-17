"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import type { Part } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants/parts";

interface PartMovementRow {
  id: string;
  part_id: string;
  movement_type: string;
  quantity: number;
  car_id: string | null;
  job_description: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
  cars?: { vin: string; brand: string; model: string } | null;
}

interface PartHistoryDialogProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartHistoryDialog({
  part,
  open,
  onOpenChange,
}: PartHistoryDialogProps) {
  const [movements, setMovements] = useState<PartMovementRow[]>([]);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!part?.id || !open) return;
    setLoading(true);
    const client = createClient();
    client
      .from("part_movements")
      .select("*, profiles:created_by(full_name), cars:car_id(vin, brand, model)")
      .eq("part_id", part.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          client
            .from("part_movements")
            .select("*")
            .eq("part_id", part.id)
            .order("created_at", { ascending: false })
            .then(({ data: d }) => {
              setMovements((d as PartMovementRow[]) ?? []);
            });
        } else {
          setMovements((data as PartMovementRow[]) ?? []);
        }
        setLoading(false);
      });
  }, [part?.id, open]);

  const sign = (mov: PartMovementRow) =>
    mov.movement_type === "stock_in" || mov.movement_type === "return"
      ? "+"
      : "-";
  const by = (mov: PartMovementRow) =>
    (mov.profiles as { full_name?: string } | undefined)?.full_name ?? "Unknown";
  const carInfo = (mov: PartMovementRow) => {
    const c = mov.cars as { vin?: string; brand?: string; model?: string } | undefined;
    if (!c) return null;
    const vin = c.vin ? `${String(c.vin).slice(-8)}` : "";
    return `${vin} (${c.brand ?? ""} ${c.model ?? ""})`.trim();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Movement History: {part?.part_name ?? ""}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-muted-foreground py-4">Loading...</p>
        ) : movements.length === 0 ? (
          <p className="text-muted-foreground py-4">No movements yet.</p>
        ) : (
          <ul className="space-y-3">
            {movements.map((mov) => (
              <li
                key={mov.id}
                className="flex flex-col gap-1 rounded-lg border p-3 text-sm"
              >
                <div className="font-medium">
                  {MOVEMENT_TYPE_LABELS[mov.movement_type] ?? mov.movement_type}{" "}
                  {sign(mov)}{Math.abs(mov.quantity)}
                </div>
                <div className="text-muted-foreground text-xs">
                  {carInfo(mov) && `Used on ${carInfo(mov)}`}
                  {mov.job_description && ` · ${mov.job_description}`}
                  {mov.note && ` · ${mov.note}`}
                </div>
                <div className="text-muted-foreground text-xs">
                  By {by(mov)} ·{" "}
                  {new Date(mov.created_at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
