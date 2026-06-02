"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatError } from "@/lib/error-messages";
import { JOB_STATUS_LABELS } from "@/lib/constants/jobs";
import { BAY_TYPE_GROUP_LABEL } from "@/lib/garage-bays";
import type { GarageBayType } from "@/types/database";

/** Title-case a raw enum like "in_progress" → "In progress" / "owner" → "Owner". */
function labelize(s: string | null | undefined): string {
  if (!s) return "—";
  const spaced = s.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

interface JobEfficiencyRow {
  job_id: string;
  job_number: string | null;
  vin: string | null;
  brand: string | null;
  model: string | null;
  status: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  variance_hours: number | null;
  on_time: boolean | null;
  parts_cost_total: number | null;
  parts_currency: string | null;
}

interface BayUtilizationRow {
  bay_id: number;
  bay_number: number | null;
  name: string;
  bay_type: string;
  status: string;
  hours_occupied_30d: number | null;
  jobs_30d: number | null;
  avg_dwell_hours: number | null;
  utilization_pct: number | null;
}

interface EmployeeEfficiencyRow {
  user_id: string;
  employee_name: string | null;
  role: string | null;
  jobs_count_30d: number | null;
  total_hours_30d: number | null;
  avg_hours_per_entry: number | null;
  avg_actual_vs_estimated_ratio: number | null;
}

function fmtNum(n: number | null | undefined, digits = 2) {
  if (n == null) return "—";
  return Number(n).toFixed(digits);
}

export default function GarageEfficiencyPage() {
  const router = useRouter();
  const supabase = createClient();
  const { canManageGarage, loading: profileLoading } = useUser();
  const [jobs, setJobs] = useState<JobEfficiencyRow[]>([]);
  const [jobTitles, setJobTitles] = useState<Record<string, string>>({});
  const [bays, setBays] = useState<BayUtilizationRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeEfficiencyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileLoading && !canManageGarage) {
      router.replace("/garage");
    }
  }, [profileLoading, canManageGarage, router]);

  useEffect(() => {
    if (!canManageGarage) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [jobsRes, baysRes, empsRes] = await Promise.all([
        supabase
          .from("garage_job_efficiency")
          .select("*")
          .order("variance_hours", { ascending: false, nullsFirst: false })
          .limit(100),
        supabase
          .from("garage_bay_utilization")
          .select("*")
          .order("utilization_pct", { ascending: false, nullsFirst: false }),
        supabase
          .from("garage_employee_efficiency")
          .select("*")
          .order("total_hours_30d", { ascending: false, nullsFirst: false }),
      ]);
      if (cancelled) return;
      if (jobsRes.error) toast.error(formatError(jobsRes.error));
      if (baysRes.error) toast.error(formatError(baysRes.error));
      if (empsRes.error) toast.error(formatError(empsRes.error));
      const jobRows = (jobsRes.data as JobEfficiencyRow[]) ?? [];
      setJobs(jobRows);
      setBays((baysRes.data as BayUtilizationRow[]) ?? []);
      setEmployees((empsRes.data as EmployeeEfficiencyRow[]) ?? []);
      setLoading(false);

      // The efficiency view exposes job_id (and a usually-null job_number) but
      // not the human title — fetch titles so the Job column is readable.
      const ids = Array.from(new Set(jobRows.map((j) => j.job_id)));
      if (ids.length > 0) {
        const { data: titleRows } = await supabase
          .from("garage_jobs")
          .select("id, title")
          .in("id", ids);
        if (cancelled) return;
        const map: Record<string, string> = {};
        ((titleRows as { id: string; title: string | null }[]) ?? []).forEach(
          (t) => {
            if (t.title) map[t.id] = t.title;
          }
        );
        setJobTitles(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, canManageGarage]);

  if (profileLoading || !canManageGarage) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">Garage Efficiency</h1>
        <p className="text-sm text-muted-foreground">
          Last 30 days · jobs, bays, and technicians
        </p>
      </div>

      <Card data-tour-id="garage-efficiency-jobs-panel">
        <CardHeader>
          <CardTitle>Job efficiency (estimated vs actual hours)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground">No jobs in window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Job</th>
                    <th className="py-2 pr-3">Car</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Est h</th>
                    <th className="py-2 pr-3">Act h</th>
                    <th className="py-2 pr-3">Var</th>
                    <th className="py-2 pr-3">On time</th>
                    <th className="py-2 pr-3">Parts cost</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((r) => (
                    <tr key={r.job_id} className="border-t">
                      <td className="py-2 pr-3">
                        <Link
                          href={`/garage/jobs/${r.job_id}`}
                          className="text-primary hover:underline"
                        >
                          {jobTitles[r.job_id] ?? r.job_number ?? r.job_id.slice(0, 6)}
                        </Link>
                      </td>
                      <td className="py-2 pr-3">
                        {r.brand ?? "—"} {r.model ?? ""}
                        {r.vin ? (
                          <span className="ml-1 font-mono text-xs text-muted-foreground">
                            …{r.vin.slice(-6)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{r.status ? (JOB_STATUS_LABELS[r.status] ?? labelize(r.status)) : "—"}</td>
                      <td className="py-2 pr-3">{fmtNum(r.estimated_hours, 1)}</td>
                      <td className="py-2 pr-3">{fmtNum(r.actual_hours, 2)}</td>
                      <td
                        className={`py-2 pr-3 ${
                          (r.variance_hours ?? 0) > 0
                            ? "text-red-600"
                            : (r.variance_hours ?? 0) < 0
                              ? "text-green-600"
                              : ""
                        }`}
                      >
                        {fmtNum(r.variance_hours, 2)}
                      </td>
                      <td className="py-2 pr-3">
                        {r.on_time == null ? "—" : r.on_time ? "✓" : "✗"}
                      </td>
                      <td className="py-2 pr-3">
                        {fmtNum(r.parts_cost_total, 2)} {r.parts_currency ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour-id="garage-efficiency-bays-panel">
        <CardHeader>
          <CardTitle>Bay utilization (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : bays.length === 0 ? (
            <p className="text-muted-foreground">No bays.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Bay</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Jobs</th>
                    <th className="py-2 pr-3">Hours occ.</th>
                    <th className="py-2 pr-3">Avg dwell h</th>
                    <th className="py-2 pr-3">Utilization %</th>
                  </tr>
                </thead>
                <tbody>
                  {bays.map((b) => (
                    <tr key={b.bay_id} className="border-t">
                      <td className="py-2 pr-3">{b.name}</td>
                      <td className="py-2 pr-3">{BAY_TYPE_GROUP_LABEL[b.bay_type as GarageBayType] ?? labelize(b.bay_type)}</td>
                      <td className="py-2 pr-3">{labelize(b.status)}</td>
                      <td className="py-2 pr-3">{b.jobs_30d ?? 0}</td>
                      <td className="py-2 pr-3">{fmtNum(b.hours_occupied_30d, 1)}</td>
                      <td className="py-2 pr-3">{fmtNum(b.avg_dwell_hours, 1)}</td>
                      <td className="py-2 pr-3">{fmtNum(b.utilization_pct, 1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour-id="garage-efficiency-technicians-panel">
        <CardHeader>
          <CardTitle>Technician efficiency (30d)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground">No time entries in window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Technician</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Jobs</th>
                    <th className="py-2 pr-3">Total h</th>
                    <th className="py-2 pr-3">Avg h/entry</th>
                    <th className="py-2 pr-3">Act/Est ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.user_id} className="border-t">
                      <td className="py-2 pr-3">{e.employee_name ?? "—"}</td>
                      <td className="py-2 pr-3">{labelize(e.role)}</td>
                      <td className="py-2 pr-3">{e.jobs_count_30d ?? 0}</td>
                      <td className="py-2 pr-3">{fmtNum(e.total_hours_30d, 2)}</td>
                      <td className="py-2 pr-3">{fmtNum(e.avg_hours_per_entry, 2)}</td>
                      <td
                        className={`py-2 pr-3 ${
                          (e.avg_actual_vs_estimated_ratio ?? 1) > 1
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {fmtNum(e.avg_actual_vs_estimated_ratio, 2)}
                      </td>
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
