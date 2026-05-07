"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { formatLiveDuration, formatDurationMinutes } from "@/lib/garage-bays";
import { Button } from "@/components/ui/button";
import { Play, Pause, PlayCircle } from "lucide-react";
import { formatError } from "@/lib/error-messages";

interface EntryRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
}

function profileName(p: EntryRow["profiles"]): string | null {
  if (!p) return null;
  const one = Array.isArray(p) ? p[0] : p;
  return one?.full_name ?? null;
}

export function JobTimeEntryControls({
  jobId,
  jobStatus,
  actualHours,
  canControl,
  carVinShort,
  onChanged,
}: {
  jobId: string;
  jobStatus: string;
  actualHours: number | null;
  canControl: boolean;
  carVinShort: string;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("job_time_entries")
      .select("id, user_id, started_at, ended_at, duration_minutes, profiles:user_id(full_name)")
      .eq("job_id", jobId)
      .order("started_at", { ascending: true });
    if (error) {
      toast.error(formatError(error));
      setEntries([]);
    } else {
      setEntries((data as EntryRow[]) ?? []);
    }
    setLoading(false);
  }, [jobId, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const openEntry = useMemo(
    () => entries.find((e) => !e.ended_at) ?? null,
    [entries]
  );

  // Warn if the user closes / refreshes the tab while still clocked in.
  // (Modern browsers ignore the custom message, but the prompt itself appears.)
  useEffect(() => {
    if (!openEntry) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [openEntry]);

  // Persistent banner once the current open session has been running 8h+.
  // Triggers once per session — when the user pauses/closes the toast clears
  // because openEntry changes.
  useEffect(() => {
    if (!openEntry) return;
    const start = new Date(openEntry.started_at).getTime();
    const eightHoursMs = 8 * 60 * 60 * 1000;
    const fireAt = start + eightHoursMs;
    const delay = Math.max(0, fireAt - Date.now());
    const id = window.setTimeout(() => {
      toast.warning(
        "You've been clocked in for 8+ hours. If your shift ended, please pause or finish the job.",
        { duration: Infinity, id: `clockin-${openEntry.id}` }
      );
    }, delay);
    return () => {
      window.clearTimeout(id);
      toast.dismiss(`clockin-${openEntry.id}`);
    };
  }, [openEntry]);

  const closedMinutes = useMemo(
    () =>
      entries.reduce((sum, e) => sum + (e.duration_minutes && e.ended_at ? e.duration_minutes : 0), 0),
    [entries]
  );

  const totalDisplayMins = useMemo(() => {
    if (!openEntry) return closedMinutes;
    const live = Math.floor(
      (Date.now() - new Date(openEntry.started_at).getTime()) / 60000
    );
    return closedMinutes + Math.max(0, live);
  }, [closedMinutes, openEntry]);

  async function handleStartOrResume() {
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setBusy(false);
      return;
    }

    const { error: insErr } = await supabase.from("job_time_entries").insert({
      job_id: jobId,
      user_id: user.id,
      started_at: new Date().toISOString(),
    });
    if (insErr) {
      toast.error(formatError(insErr));
      setBusy(false);
      return;
    }

    // Preserve the FIRST started_at across pause/resume so audit trails and
    // overtime calculations always reference the original start of work, not
    // the most recent resume. Each session's per-resume start is captured
    // in the job_time_entries row itself.
    const now = new Date().toISOString();
    const { data: jobRow } = await supabase
      .from("garage_jobs")
      .select("started_at")
      .eq("id", jobId)
      .single();
    const existingStartedAt = (jobRow as { started_at?: string | null } | null)?.started_at;
    const { error: upErr } = await supabase
      .from("garage_jobs")
      .update({
        status: "in_progress",
        started_at: existingStartedAt ?? now,
      })
      .eq("id", jobId);
    if (upErr) {
      toast.error(formatError(upErr));
      setBusy(false);
      return;
    }

    toast.success(jobStatus === "pending" ? "Timer started" : "Session resumed");
    await load();
    onChanged();
    setBusy(false);
  }

  async function handlePause() {
    if (!openEntry) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    const mins = Math.max(
      1,
      Math.round((Date.now() - new Date(openEntry.started_at).getTime()) / 60000)
    );

    const { error: e1 } = await supabase
      .from("job_time_entries")
      .update({ ended_at: nowIso, duration_minutes: mins })
      .eq("id", openEntry.id);
    if (e1) {
      toast.error(formatError(e1));
      setBusy(false);
      return;
    }

    const { data: jobRow } = await supabase
      .from("garage_jobs")
      .select("actual_hours")
      .eq("id", jobId)
      .single();
    const current = (jobRow as { actual_hours?: number } | null)?.actual_hours ?? 0;
    const addH = mins / 60;

    // Don't null garage_jobs.started_at on pause — the original start time is
    // preserved across pauses. Whether a session is currently open is
    // determined by the existence of a job_time_entries row with ended_at IS NULL.
    const { error: e2 } = await supabase
      .from("garage_jobs")
      .update({
        actual_hours: current + addH,
      })
      .eq("id", jobId);
    if (e2) {
      toast.error(formatError(e2));
      setBusy(false);
      return;
    }

    toast.success(`Paused · +${formatDurationMinutes(mins)} this session`);
    await load();
    onChanged();
    setBusy(false);
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading time sessions…</p>;
  }

  const workerLabel = openEntry ? profileName(openEntry.profiles) ?? "Mechanic" : "";
  const vinBit = carVinShort ? ` — ${carVinShort}` : "";

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Work time (sessions)</p>
        <p className="text-muted-foreground font-mono text-xs">
          Total (all sessions): {formatDurationMinutes(totalDisplayMins)}
        </p>
      </div>

      {openEntry && (
        <p className="text-sm">
          <span className="text-muted-foreground">Current session:</span>{" "}
          {workerLabel}
          {vinBit} — {formatLiveDuration(openEntry.started_at)}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="text-muted-foreground max-h-32 space-y-1 overflow-y-auto text-xs">
          {entries.map((e) => (
            <li key={e.id}>
              {profileName(e.profiles) ?? "—"} ·{" "}
              {e.ended_at
                ? `${formatDurationMinutes(e.duration_minutes ?? 0)} (closed)`
                : `${formatLiveDuration(e.started_at)} (live)`}
            </li>
          ))}
        </ul>
      )}

      {canControl && jobStatus !== "done" && jobStatus !== "cancelled" && jobStatus !== "delivered" && (
        <div className="flex flex-wrap gap-2">
          {!openEntry ? (
            <Button type="button" size="sm" onClick={() => void handleStartOrResume()} disabled={busy}>
              {jobStatus === "pending" ? (
                <>
                  <Play className="mr-2 size-4" />
                  Start
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 size-4" />
                  Resume
                </>
              )}
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={() => void handlePause()} disabled={busy}>
              <Pause className="mr-2 size-4" />
              Pause
            </Button>
          )}
        </div>
      )}

      {actualHours != null && actualHours > 0 && (
        <p className="text-muted-foreground text-xs">
          Recorded on job (actual_hours, includes closed sessions): {actualHours.toFixed(2)}h
        </p>
      )}
    </div>
  );
}
