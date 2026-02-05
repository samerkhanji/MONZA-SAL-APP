"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { CarDisplay } from "@/types/database";
import { CAR_STATUS_LABELS, LOCATION_LABELS, PDI_LABELS } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CarsListPage() {
  const [cars, setCars] = useState<CarDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [vinFilter, setVinFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const supabase = createClient();

  useEffect(() => {
    async function fetchCars() {
      setLoading(true);
      let query = supabase
        .from("cars_display")
        .select("*")
        .order("created_at", { ascending: false });

      if (vinFilter.trim()) {
        query = query.ilike("vin", `%${vinFilter.trim()}%`);
      }
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (locationFilter !== "all") {
        query = query.eq("location_type", locationFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        setCars([]);
      } else {
        setCars((data as CarDisplay[]) ?? []);
      }
      setLoading(false);
    }
    fetchCars();
  }, [vinFilter, statusFilter, locationFilter]);

  return (
    <div className="container mx-auto space-y-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Car Inventory</h1>
          <p className="text-muted-foreground">View and manage all cars</p>
        </div>
        <Button asChild>
          <Link href="/cars/add">Add Car</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>VIN, status, location</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Input
            placeholder="Search VIN..."
            value={vinFilter}
            onChange={(e) => setVinFilter(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(CAR_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {Object.entries(LOCATION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cars</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${cars.length} car(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : cars.length === 0 ? (
            <p className="text-muted-foreground">No cars found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableHead>VIN</TableHead>
                <TableHead>Model / Year</TableHead>
                <TableHead>Ext / Int</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>PDI</TableHead>
                <TableHead>Date arrived</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableHeader>
              <TableBody>
                {cars.map((car) => (
                  <TableRow key={car.id}>
                    <TableCell className="font-mono text-sm">
                      {car.vin_short ?? car.vin.slice(-8)}
                    </TableCell>
                    <TableCell>
                      {car.model} {car.model_year ? `(${car.model_year})` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {car.exterior_color ?? "—"} / {car.interior_color ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CAR_STATUS_LABELS[car.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {LOCATION_LABELS[car.location_type]}
                      {car.location_slot ? ` · ${car.location_slot}` : ""}
                    </TableCell>
                    <TableCell>{car.battery_display ?? "—"}</TableCell>
                    <TableCell>{PDI_LABELS[car.pdi_status]}</TableCell>
                    <TableCell>
                      {car.date_arrived
                        ? new Date(car.date_arrived).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/cars/${car.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
