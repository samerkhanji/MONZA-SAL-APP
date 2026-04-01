"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarStatus } from "@/types/database";
import { TEST_DRIVE_STATUS_LABELS } from "@/types/database";
import {
  fetchActiveTestDrives,
  fetchRecentReturnedTestDrives,
  type TestDriveWithCar,
} from "@/lib/data/test-drives";
import { TestDriveFormSheet, type TestDriveCarSummary } from "@/components/test-drive/TestDriveFormSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { ScanLine, Loader2 } from "lucide-react";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

function statusBadgeVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "out_for_test_drive") return "default";
  if (s === "returned") return "secondary";
  if (s === "cancelled") return "destructive";
  return "outline";
}

export default function TestDrivePage() {
  const supabase = createClient();
  const { profile, loading: userLoading } = useUser();
  const [scanOpen, setScanOpen] = useState(false);
  const [vinInput, setVinInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const [activeRows, setActiveRows] = useState<TestDriveWithCar[]>([]);
  const [returnedRows, setReturnedRows] = useState<TestDriveWithCar[]>([]);
  const [listLoading, setListLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetCar, setSheetCar] = useState<TestDriveCarSummary | null>(null);
  const [sheetExisting, setSheetExisting] = useState<TestDriveWithCar | null>(null);

  const loadLists = useCallback(async () => {
    setListLoading(true);
    const [a, r] = await Promise.all([
      fetchActiveTestDrives(supabase),
      fetchRecentReturnedTestDrives(supabase, 30),
    ]);
    if (a.error) toast.error(a.error.message);
    if (r.error) toast.error(r.error.message);
    setActiveRows(a.data);
    setReturnedRows(r.data);
    setListLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const handleVinLookup = useCallback(
    async (raw: string) => {
      const vin = raw.trim().toUpperCase();
      if (!VIN_REGEX.test(vin)) {
        toast.error("Enter a valid 17-character VIN.");
        return;
      }
      if (!profile?.id) {
        toast.error("You must be logged in.");
        return;
      }

      setLookupLoading(true);
      const { data: carRow, error: carErr } = await supabase
        .from("cars")
        .select("id, vin, brand, model, status, current_km, battery_percent")
        .eq("vin", vin)
        .is("deleted_at", null)
        .maybeSingle();

      if (carErr || !carRow) {
        toast.error(carErr?.message ?? "No vehicle found for this VIN.");
        setLookupLoading(false);
        return;
      }

      const car = carRow as TestDriveCarSummary;

      const { data: activeTd, error: tdErr } = await supabase
        .from("test_drives")
        .select(
          `
        *,
        cars:car_id (
          id,
          vin,
          brand,
          model,
          status,
          current_km,
          battery_percent
        )
      `
        )
        .eq("car_id", car.id)
        .eq("status", "out_for_test_drive")
        .order("test_drive_start_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tdErr) {
        toast.error(tdErr.message);
        setLookupLoading(false);
        return;
      }

      if (activeTd) {
        toast.warning("This vehicle is already out on a test drive. Opening the active record.");
        setSheetExisting(activeTd as TestDriveWithCar);
        setSheetCar({
          id: car.id,
          vin: car.vin,
          brand: car.brand,
          model: car.model,
          status: car.status as CarStatus,
          current_km: car.current_km,
          battery_percent: car.battery_percent,
        });
      } else {
        setSheetExisting(null);
        setSheetCar({
          id: car.id,
          vin: car.vin,
          brand: car.brand,
          model: car.model,
          status: car.status as CarStatus,
          current_km: car.current_km,
          battery_percent: car.battery_percent,
        });
      }

      setSheetOpen(true);
      setVinInput("");
      setScanOpen(false);
      setLookupLoading(false);
    },
    [supabase, profile]
  );

  const handleVinLookupRef = useRef(handleVinLookup);
  handleVinLookupRef.current = handleVinLookup;

  useEffect(() => {
    function onVinEvent(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail?.trim()) void handleVinLookupRef.current(detail.trim());
    }
    window.addEventListener("test-drive-scan-vin", onVinEvent);
    return () => window.removeEventListener("test-drive-scan-vin", onVinEvent);
  }, []);

  function openRow(td: TestDriveWithCar) {
    const c = td.cars;
    setSheetExisting(td);
    setSheetCar(
      c
        ? {
            id: c.id,
            vin: c.vin,
            brand: c.brand,
            model: c.model,
            status: c.status as CarStatus,
            current_km: c.current_km,
            battery_percent: c.battery_percent,
          }
        : {
            id: td.car_id,
            vin: td.vin,
            brand: "",
            model: "",
            status: "showroom",
            current_km: null,
            battery_percent: null,
          }
    );
    setSheetOpen(true);
  }

  if (userLoading || !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-24 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Test Drive</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Scan a VIN to start or manage a test drive. Only one active outing per vehicle. Apply migration{" "}
          <code className="rounded bg-muted px-1 text-xs">034_test_drives</code> in Supabase first.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Scan or enter VIN</CardTitle>
          <CardDescription>17-character VIN — keyboard or camera</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Input
              placeholder="e.g. LDP95H969PE309648"
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              className="font-mono uppercase"
              maxLength={17}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleVinLookup(vinInput);
              }}
              aria-label="VIN"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="gap-2" onClick={() => setScanOpen(true)}>
              <ScanLine className="size-4" />
              Scan
            </Button>
            <Button type="button" disabled={lookupLoading} onClick={() => void handleVinLookup(vinInput)}>
              {lookupLoading ? <Loader2 className="size-4 animate-spin" /> : "Look up"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active test drives</CardTitle>
          <CardDescription>Vehicles currently out</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          {listLoading ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">Loading…</p>
          ) : activeRows.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">No active test drives.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Vehicle</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Staff</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="pr-6 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeRows.map((td) => (
                    <TableRow key={td.id}>
                      <TableCell className="pl-6 font-medium">
                        {td.cars ? `${td.cars.brand} ${td.cars.model}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{td.vin}</TableCell>
                      <TableCell>
                        {td.customer_name || td.customer_phone || "—"}
                      </TableCell>
                      <TableCell>{td.employee_name ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(td.test_drive_start_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button size="sm" variant="outline" onClick={() => openRow(td)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent returns</CardTitle>
          <CardDescription>Last completed test drives</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:px-6">
          {listLoading ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">Loading…</p>
          ) : returnedRows.length === 0 ? (
            <p className="text-muted-foreground px-6 py-8 text-center text-sm">No returned test drives yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Vehicle</TableHead>
                    <TableHead>VIN</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Returned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-6 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnedRows.map((td) => (
                    <TableRow key={td.id}>
                      <TableCell className="pl-6 font-medium">
                        {td.cars ? `${td.cars.brand} ${td.cars.model}` : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{td.vin}</TableCell>
                      <TableCell>{td.customer_name || td.customer_phone || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {td.actual_return_at
                          ? new Date(td.actual_return_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(td.status)} className="text-xs">
                          {TEST_DRIVE_STATUS_LABELS[td.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openRow(td)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ScannerDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(v) => void handleVinLookup(v)}
        title="Scan VIN"
        placeholder="VIN…"
        scanType="vin"
      />

      <TestDriveFormSheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) {
            setSheetCar(null);
            setSheetExisting(null);
          }
        }}
        car={sheetCar}
        existing={sheetExisting}
        profile={profile}
        onSaved={() => void loadLists()}
      />
    </div>
  );
}
