"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarDocuments } from "@/components/car-documents";
import { CustomerDocuments } from "@/components/customers/CustomerDocuments";
import { Search, FileText, ScanLine, User } from "lucide-react";
import { ScannerDialog } from "@/components/scanner/ScannerDialog";
import { createNotificationsForUsers } from "@/lib/notifications";
import { getOwnerIds } from "@/lib/user-lookup";

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

interface CustomerSearchResult {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_primary: string | null;
  phone_secondary: string | null;
}

function customerDisplayName(c: CustomerSearchResult): string {
  if (c.full_name && c.full_name.trim()) return c.full_name.trim();
  const combined = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  return combined || "Unnamed customer";
}

type SearchMode = "vin" | "customer";

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vinFromUrl = searchParams.get("vin") ?? "";
  const { profile, isOwner } = useUser();
  const supabase = createClient();

  const [mode, setMode] = useState<SearchMode>("vin");

  // ─── VIN mode state ───
  const [vinSearch, setVinSearch] = useState(vinFromUrl);
  const [car, setCar] = useState<CarDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [scanVinOpen, setScanVinOpen] = useState(false);
  const [accessRequests, setAccessRequests] = useState<DocumentAccessRequest[]>([]);

  // ─── Customer mode state ───
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearched, setCustomerSearched] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  useEffect(() => {
    if (vinFromUrl && isValidVin(vinFromUrl)) {
      setMode("vin");
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

  const fetchAccessRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("document_access_requests")
      .select("id, search_query, status, created_at")
      .eq("requested_by", user.id)
      .order("created_at", { ascending: false });
    setAccessRequests((data as DocumentAccessRequest[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (!isOwner && profile) fetchAccessRequests();
  }, [isOwner, profile, fetchAccessRequests]);

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

    const ownerIds = await getOwnerIds();
    if (ownerIds.length > 0) {
      await createNotificationsForUsers(
        ownerIds,
        "Document access requested",
        `${profile?.full_name ?? "An employee"} is requesting access to documents matching: "${vin}"`,
        "/documents",
        { type: "document_access_request", document_access_request_id: (req as { id: string }).id }
      );
    }

    setCar(null);
    fetchAccessRequests();
  }

  async function handleViewApproved(vinInput: string) {
    const vin = vinInput.trim().toUpperCase();
    setMode("vin");
    setVinSearch(vin);
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

  async function handleCustomerSearch(e?: React.FormEvent) {
    e?.preventDefault();
    // Strip characters that break the PostgREST or() filter syntax.
    const term = customerSearch.replace(/[,()]/g, " ").trim();
    if (!term) return;

    setCustomerLoading(true);
    setCustomerSearched(true);
    setSelectedCustomer(null);

    const like = `%${term}%`;
    const { data, error } = await supabase
      .from("customers_display")
      .select("id, full_name, first_name, last_name, phone_primary, phone_secondary")
      .is("deleted_at", null)
      .or(
        `full_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone_primary.ilike.${like},phone_secondary.ilike.${like}`
      )
      .order("full_name", { ascending: true })
      .limit(25);

    setCustomerLoading(false);
    setCustomerResults(error || !data ? [] : (data as CustomerSearchResult[]));
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "vin" ? "default" : "outline"}
          onClick={() => setMode("vin")}
        >
          <FileText className="mr-2 size-4" />
          By VIN
        </Button>
        <Button
          variant={mode === "customer" ? "default" : "outline"}
          onClick={() => setMode("customer")}
        >
          <User className="mr-2 size-4" />
          By Customer / Phone
        </Button>
      </div>

      {mode === "vin" && (
        <>
          <Card data-tour-id="documents-search-panel">
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
                      data-tour-id="documents-vin-search-input"
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
                    data-tour-id="documents-scan-vin-button"
                  >
                    <ScanLine className="size-4" />
                  </Button>
                </div>
                <Button type="submit" disabled={loading || !vinSearch.trim()} data-tour-id="documents-search-button">
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
        </>
      )}

      {mode === "customer" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5" />
                Documents by Customer
              </CardTitle>
              <CardDescription>
                Search by client name or phone number to view and manage their documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCustomerSearch} className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="document-customer-search"
                    name="document-customer-search"
                    placeholder="Client name or phone number"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                    disabled={customerLoading}
                  />
                </div>
                <Button type="submit" disabled={customerLoading || !customerSearch.trim()}>
                  {customerLoading ? "Searching..." : "Search"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {selectedCustomer ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Documents for{" "}
                  <span className="font-medium text-foreground">
                    {customerDisplayName(selectedCustomer)}
                  </span>
                  {selectedCustomer.phone_primary
                    ? ` — ${selectedCustomer.phone_primary}`
                    : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    ← Back to results
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/customers/${selectedCustomer.id}`)}
                  >
                    Open full profile →
                  </Button>
                </div>
              </div>
              <CustomerDocuments customerId={selectedCustomer.id} />
            </div>
          ) : customerSearched ? (
            customerLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : customerResults.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No customers found for that name or phone number.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Matching Customers</CardTitle>
                  <CardDescription>
                    Select a customer to view and manage their documents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomer(c)}
                        className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">
                            {customerDisplayName(c)}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            {c.phone_primary ?? "No phone"}
                            {c.phone_secondary ? ` · ${c.phone_secondary}` : ""}
                          </p>
                        </div>
                        <span className="text-muted-foreground text-sm">View →</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Search by client name or phone number above to view their documents.
                </p>
              </CardContent>
            </Card>
          )}
        </>
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
