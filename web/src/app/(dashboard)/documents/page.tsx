"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { CarDisplay } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CarDocuments } from "@/components/car-documents";
import { Search, FileText } from "lucide-react";

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

function isValidVin(vin: string): boolean {
  return VIN_REGEX.test(vin.trim().toUpperCase());
}

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vinFromUrl = searchParams.get("vin") ?? "";
  const supabase = createClient();
  const [vinSearch, setVinSearch] = useState(vinFromUrl);
  const [car, setCar] = useState<CarDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (vinFromUrl && isValidVin(vinFromUrl)) {
      setVinSearch(vinFromUrl.toUpperCase());
      setSearched(false);
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
  }, [vinFromUrl]);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const vin = vinSearch.trim().toUpperCase();
    if (!vin) return;
    if (!isValidVin(vin)) {
      setCar(null);
      setSearched(true);
      return;
    }

    setLoading(true);
    setSearched(true);
    const { data, error } = await supabase
      .from("cars_display")
      .select("*")
      .eq("vin", vin)
      .maybeSingle();

    setLoading(false);

    if (error || !data) {
      setCar(null);
      return;
    }
    setCar(data as CarDisplay);
  }

  function openCarProfile() {
    if (car?.vin) {
      router.push(`/cars/${encodeURIComponent(car.vin)}`);
    }
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
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
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Enter VIN (17 characters)"
                value={vinSearch}
                onChange={(e) => setVinSearch(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9 font-mono"
                maxLength={17}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !vinSearch.trim()}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searched && (
        <>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
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
                <Button variant="outline" size="sm" onClick={openCarProfile}>
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
    </div>
  );
}
