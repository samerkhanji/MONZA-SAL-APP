"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CustomerDisplay } from "@/types/database";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_COLORS,
} from "@/lib/constants/customers";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditCustomerDialog } from "@/components/customers/EditCustomerDialog";
import { ExportButton } from "@/components/ExportButton";
import type { ExportColumn } from "@/lib/exportToExcel";

interface SoldCar {
  id: string;
  car_id: string;
  customer_id: string;
  status: string;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  delivery_date: string | null;
  cars: {
    vin: string;
    brand: string;
    model: string;
    model_year: number | null;
    exterior_color: string | null;
    status: string;
  } | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone_primary: string | null;
  } | null;
}

interface ReservedCar {
  id: string;
  vin: string;
  brand: string;
  model: string;
  model_year: number | null;
  exterior_color: string | null;
  status: string;
  client_name: string | null;
  client_phone: string | null;
  reservation_date: string | null;
  reserved_by: string | null;
}

function matchesSearch(customer: CustomerDisplay, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const fullName = (
    customer.full_name ?? `${customer.first_name} ${customer.last_name ?? ""}`.trim()
  ).toLowerCase();
  const phone = (customer.phone_primary ?? "").toLowerCase();
  const email = (customer.email ?? "").toLowerCase();
  return fullName.includes(q) || phone.includes(q) || email.includes(q);
}

export default function CustomersPage() {
  const router = useRouter();
  const { canEditInventory, canDelete } = useUser();
  const [customers, setCustomers] = useState<CustomerDisplay[]>([]);
  const [soldCars, setSoldCars] = useState<SoldCar[]>([]);
  const [reservedCars, setReservedCars] = useState<ReservedCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [soldLoading, setSoldLoading] = useState(true);
  const [reservedLoading, setReservedLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [editCustomer, setEditCustomer] = useState<CustomerDisplay | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteCustomer, setDeleteCustomer] = useState<CustomerDisplay | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const supabase = createClient();

  async function fetchCustomers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers_display")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load customers");
      setCustomers([]);
    } else {
      setCustomers((data as CustomerDisplay[]) ?? []);
    }
    setLoading(false);
  }

  async function fetchSoldCars() {
    setSoldLoading(true);
    const { data, error } = await supabase
      .from("sales_orders")
      .select(`
        id,
        car_id,
        customer_id,
        status,
        selling_price,
        currency,
        sale_date,
        delivery_date,
        cars:car_id (
          vin, brand, model, model_year, exterior_color, status
        ),
        customers:customer_id (
          id, first_name, last_name, phone_primary
        )
      `)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSoldCars(data as unknown as SoldCar[]);
    }
    setSoldLoading(false);
  }

  async function fetchReservedCars() {
    setReservedLoading(true);
    const { data, error } = await supabase
      .from("cars_display")
      .select("id, vin, brand, model, model_year, exterior_color, status, client_name, client_phone, reservation_date, reserved_by")
      .eq("status", "reserved")
      .order("reservation_date", { ascending: false });

    if (!error && data) {
      setReservedCars(data as ReservedCar[]);
    }
    setReservedLoading(false);
  }

  useEffect(() => {
    fetchCustomers();
    fetchSoldCars();
    fetchReservedCars();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!matchesSearch(c, search)) return false;
      if (statusFilter !== "all" && c.lead_status !== statusFilter) return false;
      if (sourceFilter !== "all" && c.lead_source !== sourceFilter) return false;
      return true;
    });
  }, [customers, search, statusFilter, sourceFilter]);

  async function handleDelete() {
    if (!deleteCustomer) return;
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteCustomer.id);

    if (error) {
      toast.error(`Failed to delete: ${error.message}`);
      return;
    }

    toast.success("Customer removed successfully");
    setDeleteOpen(false);
    setDeleteCustomer(null);
    fetchCustomers();
  }

  function getStatusLabel(c: CustomerDisplay): string {
    return c.status_display ?? LEAD_STATUS_LABELS[c.lead_status] ?? c.lead_status;
  }

  function getSourceLabel(c: CustomerDisplay): string {
    return (
      c.source_display ?? (c.lead_source ? LEAD_SOURCE_LABELS[c.lead_source] : "") ?? "—"
    );
  }

  const customerExportColumns: ExportColumn[] = [
    { key: "first_name", header: "First Name" },
    { key: "last_name", header: "Last Name" },
    { key: "phone_primary", header: "Phone", width: 18 },
    { key: "phone_secondary", header: "Secondary Phone", width: 18 },
    { key: "email", header: "Email" },
    { key: "status_display", header: "Status" },
    { key: "source_display", header: "Source" },
    { key: "language_display", header: "Language" },
    { key: "notes", header: "Notes" },
    { key: "created_at", header: "Date Added", type: "date" },
    { key: "last_visit_date", header: "Last Visit", type: "date" },
  ];

  const customerExportData = (list: CustomerDisplay[]) =>
    list.map((c) => ({
      ...c,
      status_display: getStatusLabel(c),
      source_display: getSourceLabel(c),
      language_display: c.language_display ?? c.preferred_language ?? "",
    }));

  function CustomerTable({ list }: { list: CustomerDisplay[] }) {
    return (
      <>
        {/* Mobile */}
        <div className="space-y-3 md:hidden">
          {list.map((customer) => {
            const fullName =
              customer.full_name ??
              `${customer.first_name} ${customer.last_name ?? ""}`.trim();
            const statusClass =
              LEAD_STATUS_COLORS[customer.lead_status] ?? "bg-muted text-muted-foreground";
            return (
              <button
                key={customer.id}
                type="button"
                className="flex w-full flex-col gap-2 rounded-lg border border-border/50 bg-card p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                onClick={() => router.push(`/customers/${customer.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{fullName || "—"}</p>
                  <Badge className={`shrink-0 ${statusClass}`}>
                    {getStatusLabel(customer)}
                  </Badge>
                </div>
                {customer.phone_primary && (
                  <a
                    href={`tel:${customer.phone_primary}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-primary hover:underline"
                  >
                    {customer.phone_primary}
                  </a>
                )}
              </button>
            );
          })}
        </div>

        {/* Desktop */}
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((customer) => {
                const statusClass =
                  LEAD_STATUS_COLORS[customer.lead_status] ?? "bg-muted text-muted-foreground";
                const fullName =
                  customer.full_name ??
                  `${customer.first_name} ${customer.last_name ?? ""}`.trim();
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${customer.id}`)}
                  >
                    <TableCell className="font-medium">{fullName || "—"}</TableCell>
                    <TableCell className="text-sm">
                      <a
                        href={`tel:${customer.phone_primary}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:underline"
                      >
                        {customer.phone_primary}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {customer.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusClass}>{getStatusLabel(customer)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {getSourceLabel(customer) || "—"}
                    </TableCell>
                    <TableCell>
                      {customer.total_orders != null ? (
                        <Badge variant="secondary">{customer.total_orders}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {customer.last_visit_date
                        ? new Date(customer.last_visit_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/customers/${customer.id}`)}
                          >
                            View
                          </DropdownMenuItem>
                          {canEditInventory && (
                            <DropdownMenuItem
                              onClick={() => {
                                setEditCustomer(customer);
                                setEditOpen(true);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setDeleteCustomer(customer);
                                setDeleteOpen(true);
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <div className="container mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Customers</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${filteredCustomers.length} contact(s)`}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton
            data={customerExportData(filteredCustomers)}
            allData={customerExportData(customers)}
            columns={customerExportColumns}
            filename="Customers"
            options={{
              pageName: "Customers",
              summary: `Total Customers: ${filteredCustomers.length}`,
            }}
            disabled={loading}
          />
          {canEditInventory && (
            <Button asChild>
              <Link href="/customers/add">Add Customer</Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All Customers
            {!loading && (
              <Badge variant="secondary" className="ml-2">
                {customers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sold">
            Sold Cars
            {!soldLoading && (
              <Badge variant="secondary" className="ml-2">
                {soldCars.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads
            {!reservedLoading && (
              <Badge variant="secondary" className="ml-2">
                {reservedCars.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>
                Search by name, phone, email · Status · Source
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Input
                id="customer-search"
                name="customer-search"
                placeholder="Search name, phone, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-11 w-full text-base sm:max-w-xs sm:text-sm"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="customer-status-filter" className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {Object.entries(LEAD_STATUS_LABELS)
                    .filter(([value]) => value)
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger id="customer-source-filter" className="w-[160px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {Object.entries(LEAD_SOURCE_LABELS)
                    .filter(([value]) => value)
                    .map(([value, label]) => (
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
              <CardTitle>Customers</CardTitle>
              <CardDescription>
                {loading ? "Loading..." : `${filteredCustomers.length} contact(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : filteredCustomers.length === 0 ? (
                <p className="text-muted-foreground">
                  No customers or leads found. Add your first contact.
                </p>
              ) : (
                <CustomerTable list={filteredCustomers} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sold" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sold Cars</CardTitle>
              <CardDescription>
                {soldLoading ? "Loading..." : `${soldCars.length} sale(s) — all active sales orders`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {soldLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : soldCars.length === 0 ? (
                <p className="text-muted-foreground">No sold cars found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>VIN</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Sale Date</TableHead>
                        <TableHead>Delivery Date</TableHead>
                        <TableHead>Order Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {soldCars.map((so) => {
                        const car = so.cars;
                        const customer = so.customers;
                        const fullName = customer
                          ? `${customer.first_name} ${customer.last_name ?? ""}`.trim()
                          : "—";
                        return (
                          <TableRow key={so.id}>
                            <TableCell className="font-medium">
                              {car ? `${car.brand} ${car.model}${car.model_year ? ` (${car.model_year})` : ""}` : "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {car?.vin ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {car?.exterior_color ?? "—"}
                            </TableCell>
                            <TableCell>
                              {customer ? (
                                <button
                                  type="button"
                                  className="text-primary hover:underline text-sm font-medium"
                                  onClick={() => router.push(`/customers/${customer.id}`)}
                                >
                                  {fullName}
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {customer?.phone_primary ? (
                                <a
                                  href={`tel:${customer.phone_primary}`}
                                  className="text-primary hover:underline"
                                >
                                  {customer.phone_primary}
                                </a>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {so.selling_price != null
                                ? `${Number(so.selling_price).toLocaleString()} ${so.currency ?? "USD"}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {so.sale_date
                                ? new Date(so.sale_date).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {so.delivery_date
                                ? new Date(so.delivery_date).toLocaleDateString()
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{so.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {customer && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/customers/${customer.id}`)}
                                  >
                                    Customer →
                                  </Button>
                                )}
                                {car && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(
                                        `/cars/${encodeURIComponent(car.vin ?? so.car_id)}`
                                      )
                                    }
                                  >
                                    Car →
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads — Reserved Cars</CardTitle>
              <CardDescription>
                {reservedLoading
                  ? "Loading..."
                  : `${reservedCars.length} reserved car(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reservedLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : reservedCars.length === 0 ? (
                <p className="text-muted-foreground">No reserved cars at the moment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>VIN</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Client Name</TableHead>
                        <TableHead>Client Phone</TableHead>
                        <TableHead>Reserved By</TableHead>
                        <TableHead>Reservation Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reservedCars.map((car) => (
                        <TableRow
                          key={car.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(`/cars/${encodeURIComponent(car.vin ?? car.id)}`)
                          }
                        >
                          <TableCell className="font-medium">
                            {car.brand} {car.model}
                            {car.model_year ? ` (${car.model_year})` : ""}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {car.vin}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {car.exterior_color ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {car.client_name ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {car.client_phone ? (
                              <a
                                href={`tel:${car.client_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline"
                              >
                                {car.client_phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {car.reserved_by ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {car.reservation_date
                              ? new Date(car.reservation_date).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/cars/${encodeURIComponent(car.vin ?? car.id)}`
                                )
                              }
                            >
                              View Car →
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
        </TabsContent>
      </Tabs>

      <EditCustomerDialog
        customer={editCustomer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => {
          setEditOpen(false);
          setEditCustomer(null);
          fetchCustomers();
        }}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove customer?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this customer? This action can be undone by an
              admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
