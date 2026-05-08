"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import {
  DEALERSHIP_TZ,
  dateKeyInTz,
  monthKeyInTz,
  weekStartKeyInTz,
  shiftDateKey,
} from "@/lib/dealership-tz";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

interface EntryRow {
  id: string;
  job_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null;
}

function profileName(p: EntryRow["profiles"]): string {
  if (!p) return "—";
  const one = Array.isArray(p) ? p[0] : p;
  return one?.full_name ?? "—";
}

export default function GarageTimeReportsPage() {
  const router = useRouter();
  const { canManageGarage, loading: profileLoading } = useUser();
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (!profileLoading && !canManageGarage) {
      router.replace("/garage");
    }
  }, [profileLoading, canManageGarage, router]);

  useEffect(() => {
    if (!canManageGarage) return;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setMonth(since.getMonth() - 2);
      const { data, error } = await supabase
        .from("job_time_entries")
        .select("id, job_id, user_id, started_at, ended_at, duration_minutes, profiles:user_id(full_name)")
        .gte("started_at", since.toISOString())
        .order("started_at", { ascending: false });
      if (error) {
        setRows([]);
      } else {
        setRows((data as EntryRow[]) ?? []);
      }
      setLoading(false);
    })();
  }, [canManageGarage, supabase]);

  const table = useMemo(() => {
    // Bucket by the dealership's local calendar in DEALERSHIP_TZ, regardless
    // of where the viewer's browser is. Comparison is by "YYYY-MM-DD" string
    // keys, which sort correctly and are DST-safe.
    const now = new Date();
    const todayKey = dateKeyInTz(now);
    const weekStartKey = weekStartKeyInTz(now);
    const weekEndKey = shiftDateKey(weekStartKey, 6); // inclusive
    const thisMonthKey = monthKeyInTz(now);

    const closed = rows.filter((r) => r.ended_at && r.duration_minutes != null);
    const byUser = new Map<
      string,
      { name: string; jobsToday: Set<string>; minsToday: number; minsWeek: number; minsMonth: number }
    >();

    for (const r of closed) {
      const startedAt = new Date(r.started_at);
      const dayKey = dateKeyInTz(startedAt);
      const monthKey = monthKeyInTz(startedAt);
      const uid = r.user_id;
      const mins = r.duration_minutes ?? 0;
      const name = profileName(r.profiles);
      if (!byUser.has(uid)) {
        byUser.set(uid, {
          name,
          jobsToday: new Set(),
          minsToday: 0,
          minsWeek: 0,
          minsMonth: 0,
        });
      }
      const agg = byUser.get(uid)!;
      agg.name = name;
      if (dayKey === todayKey) {
        agg.minsToday += mins;
        agg.jobsToday.add(r.job_id);
      }
      if (dayKey >= weekStartKey && dayKey <= weekEndKey) {
        agg.minsWeek += mins;
      }
      if (monthKey === thisMonthKey) {
        agg.minsMonth += mins;
      }
    }

    return Array.from(byUser.entries()).map(([id, a]) => ({
      id,
      employee: a.name,
      jobsToday: a.jobsToday.size,
      hoursToday: (a.minsToday / 60).toFixed(2),
      hoursWeek: (a.minsWeek / 60).toFixed(2),
      hoursMonth: (a.minsMonth / 60).toFixed(2),
    }));
  }, [rows]);

  if (profileLoading || !canManageGarage) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/garage">
            <ArrowLeft className="mr-2 size-4" />
            Garage Jobs
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">Employee time reports</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Hours from completed work sessions only (paused/stopped entries). Open
        timers are not included. Today / week / month buckets are computed in{" "}
        <span className="font-mono">{DEALERSHIP_TZ}</span> time, regardless of
        where you&apos;re viewing from.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>By employee</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : table.length === 0 ? (
            <p className="text-muted-foreground text-sm">No closed time entries in the last two months.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Employee</th>
                    <th className="p-2">Jobs today</th>
                    <th className="p-2">Hours today</th>
                    <th className="p-2">Hours this week</th>
                    <th className="p-2">Hours this month</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((r) => (
                    <tr key={r.id} className="border-b border-border/60">
                      <td className="p-2 font-medium">{r.employee}</td>
                      <td className="p-2">{r.jobsToday}</td>
                      <td className="p-2 font-mono">{r.hoursToday}</td>
                      <td className="p-2 font-mono">{r.hoursWeek}</td>
                      <td className="p-2 font-mono">{r.hoursMonth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
