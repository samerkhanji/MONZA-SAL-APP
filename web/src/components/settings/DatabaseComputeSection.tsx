"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ComputePayload = {
  configured: boolean;
  projectRef: string | null;
  managementConfigured: boolean;
  current: { addonType: string; variantId: string; variantName?: string } | null;
  desired: { addonType: string; variantId: string | null } | null;
  inSync: boolean | null;
  availableVariants: { id: string; name?: string }[];
  recentEvents: Array<{
    id: string;
    event_type: string;
    severity: string;
    message: string | null;
    created_at: string;
  }>;
};

export function DatabaseComputeSection() {
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [savingDesired, setSavingDesired] = useState(false);
  const [data, setData] = useState<ComputePayload | null>(null);
  const [desiredDraft, setDesiredDraft] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/infrastructure/compute", { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as ComputePayload & { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? `Failed to load (${res.status})`);
        setData(null);
        return;
      }
      setData(json);
      setDesiredDraft(json.desired?.variantId ?? "");
    } catch {
      toast.error("Network error loading compute status.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveDesired() {
    setSavingDesired(true);
    try {
      const res = await fetch("/api/admin/infrastructure/compute/desired", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          desired_variant_id: desiredDraft.trim() === "" ? null : desiredDraft.trim(),
          desired_addon_type: data?.desired?.addonType ?? "compute_instance",
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Save failed");
        return;
      }
      toast.success("Desired compute size saved.");
      await refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setSavingDesired(false);
    }
  }

  async function retryResize() {
    setRetrying(true);
    try {
      const res = await fetch("/api/admin/infrastructure/compute/retry", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        attempts?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(j.error ?? j.message ?? `Retry failed (${res.status})`);
        await refresh();
        return;
      }
      if (j.ok) {
        toast.success(j.message ?? `Resize accepted after ${j.attempts ?? "?"} attempt(s).`);
      } else {
        toast.error(j.message ?? "Resize failed.");
      }
      await refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <Server className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Database compute</CardTitle>
              <CardDescription>
                Live size from Supabase Management API vs desired target stored in CRM. Retries use
                exponential backoff when the API reports transient errors (including &quot;compute
                resize failed&quot;). Does not fix cloud capacity limits.
              </CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {!data?.managementConfigured ? (
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Server env not fully configured: set{" "}
                <code className="text-xs">SUPABASE_MANAGEMENT_ACCESS_TOKEN</code> (fine-grained:
                infra_add_ons_read + infra_add_ons_write) and ensure{" "}
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> or{" "}
                <code className="text-xs">SUPABASE_PROJECT_REF</code> is set.
              </p>
            ) : (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Project ref</p>
                  <p className="font-mono text-xs">{data.projectRef ?? "—"}</p>
                </div>
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Current compute (API)</p>
                  <p className="font-medium">
                    {data.current?.variantId ?? "—"}
                    {data.current?.variantName ? (
                      <span className="text-muted-foreground"> · {data.current.variantName}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="desired-compute-variant">Desired compute variant</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select
                  value={desiredDraft || "__none__"}
                  onValueChange={(v) => setDesiredDraft(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger id="desired-compute-variant" className="w-full sm:max-w-md">
                    <SelectValue placeholder="Not set (match current)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not set</SelectItem>
                    {(data?.availableVariants ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.id}
                        {v.name ? ` — ${v.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={savingDesired}
                  onClick={() => void saveDesired()}
                >
                  Save desired
                </Button>
              </div>
              {data?.inSync === false && data.desired?.variantId ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Current and desired differ. Use Retry when Supabase has reported a failed resize.
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={retrying || !data?.managementConfigured} onClick={() => void retryResize()}>
                {retrying ? "Retrying…" : "Retry compute upgrade"}
              </Button>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Recent resize events</p>
              {(data?.recentEvents ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No logged events yet.</p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border text-xs">
                  {(data?.recentEvents ?? []).map((ev) => (
                    <li
                      key={ev.id}
                      className="border-b border-border/60 px-2 py-1.5 last:border-0"
                    >
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                      </span>{" "}
                      <span className="font-medium">{ev.event_type}</span>
                      {ev.message ? (
                        <span className="block truncate text-muted-foreground">{ev.message}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Alerts: after{" "}
              <code className="rounded bg-muted px-1">COMPUTE_RESIZE_ALERT_THRESHOLD</code> failures
              in 60 minutes, an email is sent to{" "}
              <code className="rounded bg-muted px-1">OPS_ALERT_EMAIL</code> or{" "}
              <code className="rounded bg-muted px-1">COMPUTE_ALERT_EMAIL</code> (requires{" "}
              <code className="rounded bg-muted px-1">RESEND_API_KEY</code> +{" "}
              <code className="rounded bg-muted px-1">RESEND_FROM_EMAIL</code>). Deduped to once per
              6 hours.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
