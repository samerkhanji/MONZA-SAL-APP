"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { GarageBay, GarageBayType } from "@/types/database";
import {
  BAY_TYPE_ADD_LABEL,
  BAY_TYPE_GROUP_ORDER,
} from "@/lib/garage-bays";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/lib/contexts/UserContext";
import { formatError } from "@/lib/error-messages";

const TYPE_LABEL = BAY_TYPE_ADD_LABEL;

export function ManageBaysDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const { isOwner } = useUser();
  const [bays, setBays] = useState<GarageBay[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<GarageBayType | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("garage_bays")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) {
      toast.error(formatError(error));
      setBays([]);
    } else {
      setBays((data as GarageBay[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function addBay(type: GarageBayType) {
    setAdding(type);
    const maxNum = bays.reduce((m, b) => Math.max(m, b.bay_number), 0);
    const nextNum = maxNum + 1;
    const sameType = bays.filter((b) => b.bay_type === type);
    const nextIdx = sameType.length + 1;
    const baseName =
      type === "normal"
        ? `Normal Bay ${nextIdx}`
        : type === "pit"
          ? "Oil Change Pit"
          : type === "car_wash"
            ? "Car Wash"
            : type === "oven"
              ? "Oven"
              : type === "paint"
                ? `Paint Bay ${nextIdx}`
                : type === "ev"
                  ? `EV Bay ${nextIdx}`
                  : type === "body_work"
                    ? `Body Work ${nextIdx}`
                    : type === "battery_lab"
                      ? `Battery Lab ${nextIdx}`
                      : "Polish Bay";
    const name =
      type === "pit" || type === "car_wash" || type === "oven" || type === "polish"
        ? sameType.length > 0
          ? `${baseName} ${nextIdx}`
          : baseName
        : baseName;

    const { error } = await supabase.from("garage_bays").insert({
      bay_number: nextNum,
      name,
      bay_type: type,
      capacity: type === "normal" ? 4 : 1,
      description: null,
      is_active: true,
      sort_order: nextNum,
    });
    setAdding(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Bay added");
    await load();
    onChanged();
  }

  async function deactivateBay(b: GarageBay) {
    if (!isOwner) return;
    setDeactivating(b.id);
    const { error } = await supabase
      .from("garage_bays")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    setDeactivating(null);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Bay deactivated");
    await load();
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,92dvh)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage bays</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Add bays by type. Only owners can deactivate a bay (hidden from the floor plan; data kept).
        </p>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-2">Bay type</th>
                  <th className="py-2 pr-2">Active count</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {BAY_TYPE_GROUP_ORDER.map((type) => {
                  const count = bays.filter((b) => b.bay_type === type && b.is_active).length;
                  return (
                    <tr key={type} className="border-b border-border/60">
                      <td className="py-2 pr-2">{TYPE_LABEL[type]}</td>
                      <td className="py-2 pr-2">{count}</td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={adding === type}
                          onClick={() => void addBay(type)}
                        >
                          {adding === type ? "Adding…" : "+ Add bay"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {isOwner && (
              <div className="rounded-md border border-border p-3">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                  Deactivate bay
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {bays
                    .filter((b) => b.is_active)
                    .map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1"
                      >
                        <span>
                          {b.name} (#{b.bay_number})
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={deactivating === b.id}
                          onClick={() => void deactivateBay(b)}
                        >
                          {deactivating === b.id ? "…" : "Deactivate"}
                        </Button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
