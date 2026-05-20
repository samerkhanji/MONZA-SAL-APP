"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowLeft, Save } from "lucide-react";
import { formatError } from "@/lib/error-messages";

interface ApprovalThresholdRow {
  id: string;
  label_en: string;
  description: string | null;
  currency: string;
  manager_floor: number;
  owner_floor: number;
  active: boolean;
}

function AccessDenied() {
  return (
    <div className="container py-12 text-center text-muted-foreground">
      <AlertTriangle className="mx-auto mb-3 size-6" />
      <p>You don&apos;t have access to approval thresholds.</p>
      <Button variant="link" asChild>
        <Link href="/settings">Back to settings</Link>
      </Button>
    </div>
  );
}

export default function ApprovalThresholdsPage() {
  const { isOwner, hasCapability, loading: userLoading } = useUser();
  const allowed = isOwner || hasCapability("manage_team");

  if (userLoading) {
    return (
      <div className="container space-y-4 py-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!allowed) {
    return <AccessDenied />;
  }

  return <Body />;
}

function Body() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ApprovalThresholdRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("approval_thresholds")
      .select("*")
      .order("id", { ascending: true });
    if (error) {
      toast.error(formatError(error));
      setRows([]);
    } else {
      setRows(((data ?? []) as ApprovalThresholdRow[]).map((r) => ({
        ...r,
        // numeric comes back as string from PostgREST; normalise.
        manager_floor: Number(r.manager_floor),
        owner_floor: Number(r.owner_floor),
      })));
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div data-tour-id="settings-approval-thresholds-intro">
          <h1 className="text-2xl font-semibold">Approval thresholds</h1>
          <p className="text-muted-foreground text-sm">
            Set the money limits that decide who needs to sign off. Below the
            manager floor it auto-approves; at or above the owner floor it goes
            to the owner.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/settings">
            <ArrowLeft className="mr-1 size-3" /> Settings
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No approval thresholds configured yet.
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ThresholdCard
              key={row.id}
              row={row}
              onSaved={(updated) =>
                setRows((prev) =>
                  prev.map((r) => (r.id === updated.id ? updated : r))
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ThresholdCard({
  row,
  onSaved,
}: {
  row: ApprovalThresholdRow;
  onSaved: (row: ApprovalThresholdRow) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [managerFloor, setManagerFloor] = useState<string>(
    String(row.manager_floor)
  );
  const [ownerFloor, setOwnerFloor] = useState<string>(
    String(row.owner_floor)
  );
  const [saving, setSaving] = useState(false);

  const managerNum = Number(managerFloor);
  const ownerNum = Number(ownerFloor);
  const managerValid = managerFloor !== "" && Number.isFinite(managerNum) && managerNum >= 0;
  const ownerValid = ownerFloor !== "" && Number.isFinite(ownerNum) && ownerNum >= 0;
  const ordered = managerValid && ownerValid && ownerNum >= managerNum;
  const dirty =
    managerNum !== row.manager_floor || ownerNum !== row.owner_floor;
  const canSave = managerValid && ownerValid && ordered && dirty && !saving;

  async function handleSave() {
    if (!managerValid || !ownerValid) {
      toast.error("Both floors must be non-negative numbers");
      return;
    }
    if (!ordered) {
      // Mirrors the DB CHECK: approval_thresholds.owner_floor >= manager_floor
      toast.error("Owner floor must be greater than or equal to manager floor");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("approval_thresholds")
      .update({
        manager_floor: managerNum,
        owner_floor: ownerNum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success("Threshold updated");
    const updated = data as ApprovalThresholdRow;
    onSaved({
      ...updated,
      manager_floor: Number(updated.manager_floor),
      owner_floor: Number(updated.owner_floor),
    });
  }

  return (
    <Card data-tour-id="settings-approval-threshold-card">
      <CardHeader>
        <CardTitle className="text-base">{row.label_en}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span>{row.description ?? "—"}</span>
          <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] uppercase">
            {row.currency}
          </span>
          {!row.active && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
              inactive
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`manager-${row.id}`}>
              Manager floor ({row.currency})
            </Label>
            <Input
              id={`manager-${row.id}`}
              data-tour-id="settings-approval-threshold-manager-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={managerFloor}
              onChange={(e) => setManagerFloor(e.target.value)}
              aria-invalid={!managerValid}
            />
            <p className="text-muted-foreground text-[11px]">
              At or above this, a manager must sign off.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`owner-${row.id}`}>
              Owner floor ({row.currency})
            </Label>
            <Input
              id={`owner-${row.id}`}
              data-tour-id="settings-approval-threshold-owner-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={ownerFloor}
              onChange={(e) => setOwnerFloor(e.target.value)}
              aria-invalid={!ownerValid || !ordered}
            />
            <p className="text-muted-foreground text-[11px]">
              At or above this, the owner must sign off.
            </p>
          </div>
        </div>

        {managerValid && ownerValid && !ordered && (
          <p className="text-sm text-destructive">
            Owner floor must be greater than or equal to manager floor.
          </p>
        )}

        <div className="flex justify-end">
          <Button
            data-tour-id="settings-approval-threshold-save"
            size="sm"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            <Save className="mr-1 size-3.5" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
