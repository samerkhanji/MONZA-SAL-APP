"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarDocuments } from "@/components/car-documents";
import { Search, FileText, ScanLine } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { createNotification } from "@/lib/notifications";
import { getProfileIdByName } from "@/lib/user-lookup";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

function isValidVin(vin: string): boolean {
  return VIN_REGEX.test(vin.trim().toUpperCase());
}

interface DocumentAccessRequest {
  id: string;
  search_query: string;
  status: string;
  created_at: string;
}

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vinFromUrl = searchParams.get("vin") ?? "";
  const { profile, isOwner } = useUser();
  const supabase = createClient();
  const [vinSearch, setVinSearch] = useState(vinFromUrl);
  const [car, setCar] = useState<CarDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [scanVinOpen, setScanVinOpen] = useState(false);
  const [accessRequests, setAccessRequests] = useState<DocumentAccessRequest[]>([]);
  const [approvedQuery, setApprovedQuery] = useState<string | null>(null);

  useEffect(() => {
    if (vinFromUrl && isValidVin(vinFromUrl)) {
      setVinSearch(vinFromUrl.toUpperCase());
      setSearched(false);
      if (isOwner) {
        const runSearch = async () => {
          setLoading(true);
          setSearched(true);
          const { data, error } = await supabase
            .from("cars_display")
            .select("*")
            .eq("vin", vinFromUrl.toUpperCase())
            .maybeSingle();
          setLoading(false);
          setCar(error || !data ? null : (data as CarDisplay));
        };
        runSearch();
      }
    }
  }, [vinFromUrl, isOwner]);

  async function fetchAccessRequests() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("document_access_requests")
      .select("id, search_query, status, created_at")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });
    setAccessRequests((data as DocumentAccessRequest[]) ?? []);
  }

  useEffect(() => {
    if (!isOwner && profile) fetchAccessRequests();
  }, [isOwner, profile?.id]);

  async function handleSearch(e?: React.FormEvent, overrideVin?: string) {
    e?.preventDefault();
    const vin = (overrideVin ?? vinSearch).trim().toUpperCase();
    if (!vin) return;
    if (!isValidVin(vin)) {
      setCar(null);
      setSearched(true);
      return;
    }

    setLoading(true);
    setSearched(true);

    if (isOwner) {
      const { data, error } = await supabase
        .from("cars_display")
        .select("*")
        .eq("vin", vin)
        .maybeSingle();

      setLoading(false);
      setCar(error || !data ? null : (data as CarDisplay));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: req, error: reqError } = await supabase
      .from("document_access_requests")
      .insert({
        requested_by: user.id,
        search_query: vin,
        status: "pending",
      })
      .select("id")
      .single();

    setLoading(false);

    if (reqError) {
      setCar(null);
      return;
    }

    const houssamId = await getProfileIdByName("Houssam");
    if (houssamId) {
      await createNotification({
        userId: houssamId,
        title: "Document access requested",
        message: `${profile?.full_name ?? "An employee"} is requesting access to documents matching: "${vin}"`,
        link: "/documents",
        metadata: { type: "document_access_request", document_access_request_id: (req as { id: string }).id },
      });
    }

    setCar(null);
    fetchAccessRequests();
  }

  async function handleViewApproved(vin: string) {
    setVinSearch(vin);
    setApprovedQuery(vin);
    setLoading(true);
    setSearched(true);
    const { data, error } = await supabase
      .from("cars_display")
      .select("*")
      .eq("vin", vin)
      .maybeSingle();
    setLoading(false);
    setCar(error || !data ? null : (data as CarDisplay));
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Documents by VIN
          </CardTitle>
          <CardDescription>
            Search by VIN to view and manage PDFs and documents for a specific car
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="document-vin-search"
                  name="document-vin-search"
                  placeholder="Enter VIN (17 characters)"
                  value={vinSearch}
                  onChange={(e) => setVinSearch(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9 font-mono"
                  maxLength={17}
                  disabled={loading}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setScanVinOpen(true)}
                title="Scan VIN"
                disabled={loading}
                className="shrink-0"
              >
                <ScanLine className="size-4" />
              </Button>
            </div>
            <Button type="submit" disabled={loading || !vinSearch.trim()}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {!isOwner && accessRequests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>
              Your document search requests and their status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accessRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-mono text-sm">{req.search_query}</p>
                    <p className="text-muted-foreground text-xs">
                      {req.status === "pending"
                        ? "Pending approval"
                        : req.status === "approved"
                          ? "Approved"
                          : "Denied"}
                    </p>
                  </div>
                  {req.status === "approved" && (
                    <Button
                      size="sm"
                      onClick={() => handleViewApproved(req.search_query)}
                    >
                      View Results
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {searched && (
        <>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !isOwner && !car ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {vinSearch.trim() && !isValidVin(vinSearch)
                    ? "Please enter a valid 17-character VIN."
                    : "Your search request has been sent to management for approval. You will be notified when access is granted."}
                </p>
              </CardContent>
            </Card>
          ) : !car ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  {vinSearch.trim() && !isValidVin(vinSearch)
                    ? "Please enter a valid 17-character VIN."
                    : "No car found for this VIN."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Documents for{" "}
                  <span className="font-mono font-medium text-foreground">
                    {car.vin}
                  </span>
                  {" — "}
                  {car.brand} {car.model}
                  {car.model_year ? ` (${car.model_year})` : ""}
                </p>
                <Button variant="outline" size="sm" onClick={() => router.push(`/cars/${encodeURIComponent(car.vin)}`)}>
                  Open full profile →
                </Button>
              </div>
              <CarDocuments carId={car.id} carVin={car.vin} />
            </div>
          )}
        </>
      )}

      {!searched && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Enter a VIN above to view documents for that vehicle.
            </p>
          </CardContent>
        </Card>
      )}

      <ScannerDialog
        open={scanVinOpen}
        onClose={() => setScanVinOpen(false)}
        onScan={(value) => {
          const v = value.toUpperCase();
          setVinSearch(v);
          setScanVinOpen(false);
          handleSearch(undefined, v);
        }}
        title="Scan VIN"
        placeholder="17-character VIN..."
        scanType="vin"
      />
    </div>
  );
}
