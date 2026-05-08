"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Plus } from "lucide-react";
import { pluralize } from "@/lib/plural";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import type { CustomerDisplay } from "@/types/database";
import { LEAD_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/lib/constants/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { canPerform } from "@/lib/permissions";

interface SoldCar {
  id: string;
  car_id: string;
  customer_id: string;
  status: string;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  date_bought: string | null;
  delivery_date: string | null;
  reservation_date: string | null;
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
    lead_status: string | null;
  } | null;
}

function matchesSearch(customer: CustomerDisplay, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const fullName = (
    customer.full_name ?? `${customer.first_name} ${customer.last_name ?? ""}`.trim()
  ).toLowerCase();
  const phone = (customer.phone_primary ?? "").toLowerCase();
  const email = (customer.email ?? "").toLowerCase();
  // Phone match also tries digits-only on both sides so "+961 1 234 5678"
  // matches a search of "9611234" or "961-1-234".
  const phoneDigits = phone.replace(/[^\d]/g, "");
  const qDigits = q.replace(/[^\d]/g, "");
  const phoneMatches =
    phone.includes(q) ||
    (qDigits.length >= 3 && phoneDigits.includes(qDigits));
  return fullName.includes(q) || phoneMatches || email.includes(q);
}

const CUSTOMERS_TABLE_COL_PX = [240, 180, 320, 110, 200, 80, 130, 110] as const;
const SOLD_TABLE_COL_PX = [220, 200, 130, 240, 160, 140, 120, 120, 170, 110] as const;

const CRM_TH =
  "sticky top-0 z-10 box-border min-w-0 max-w-full border-b-2 border-r border-border bg-[var(--table-header)] px-2 py-2 text-left align-middle text-[11px] font-semibold text-[var(--table-header-text)] whitespace-nowrap overflow-hidden text-ellipsis";
const CRM_TD =
  "box-border min-w-0 max-w-full border-b border-r border-border bg-transparent px-2 py-2 text-left align-middle text-xs whitespace-nowrap overflow-hidden text-ellipsis";

export default function CustomersPage() {
  const router = useRouter();
  const { appRole } = useUser();
  const canDeleteCustomer = canPerform("customers", "delete", appRole ?? null);
  const [customers, setCustomers] = useState<CustomerDisplay[]>([]);
  const [soldCars, setSoldCars] = useState<SoldCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [soldLoading, setSoldLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
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
        date_bought,
        delivery_date,
        reservation_date,
        cars:car_id (
          vin, brand, model, model_year, exterior_color, status
        ),
        customers:customer_id (
          id, first_name, last_name, phone_primary, lead_status
        )
      `)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSoldCars(data as unknown as SoldCar[]);
    }
    setSoldLoading(false);
  }

  useEffect(() => {
    fetchCustomers();
    fetchSoldCars();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!matchesSearch(c, debouncedSearch)) return false;
      if (statusFilter !== "all" && c.lead_status !== statusFilter) return false;
      if (sourceFilter !== "all" && c.lead_source !== sourceFilter) return false;
      return true;
    });
  }, [customers, debouncedSearch, statusFilter, sourceFilter]);

  const leadCustomers = useMemo(
    () => customers.filter((c) => c.lead_status === "new_lead"),
    [customers]
  );

  const convertedSoldCars = useMemo(
    () => soldCars.filter((so) => so.customers?.lead_status === "converted"),
    [soldCars]
  );

  const soldCustomerIds = useMemo(() => {
    const ids = new Set<string>();
    convertedSoldCars.forEach((so) => {
      if (so.customer_id) {
        ids.add(so.customer_id);
      }
    });
    return ids;
  }, [convertedSoldCars]);

  const soldCustomers = useMemo(
    () => customers.filter((c) => soldCustomerIds.has(c.id)),
    [customers, soldCustomerIds]
  );

  const exclusiveLeadCustomers = useMemo(
    () => leadCustomers.filter((c) => !soldCustomerIds.has(c.id)),
    [leadCustomers, soldCustomerIds]
  );

  async function handleDelete() {
    if (!deleteCustomer) return;
    if (!canDeleteCustomer) {
      toast.error("You don't have permission to delete customers.");
      return;
    }
    const res = await fetch(`/api/customers/${deleteCustomer.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        typeof body?.error === "string" ? body.error : `Failed to delete (${res.status})`
      );
      return;
    }

    toast.success("Customer removed successfully");
    setDeleteOpen(false);
    setDeleteCustomer(null);
    fetchCustomers();
  }

  function getStatusLabel(c: CustomerDisplay): string {
    const orders = c.total_orders ?? 0;
    if (orders > 0) return "Sold";
    if (c.lead_status === "new_lead") return "New";
    return "Lead";
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

  const canCreateCustomer = canPerform("customers", "create", appRole ?? null);
  const canEditCustomer = canPerform("customers", "edit", appRole ?? null);

  function CustomerTable({ list }: { list: CustomerDisplay[] }) {
    return (
      <div className="scrollbar-thick w-full min-w-0 max-h-[min(72vh,calc(100dvh-14rem))] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card [-webkit-overflow-scrolling:touch]">
        <table className="w-max min-w-full table-fixed border-collapse">
          <colgroup>
            {CUSTOMERS_TABLE_COL_PX.map((w, i) => (
              <col key={i} style={{ width: `${w}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={CRM_TH}>
                Name
              </th>
              <th scope="col" className={CRM_TH}>
                Phone
              </th>
              <th scope="col" className={CRM_TH}>
                Email
              </th>
              <th scope="col" className={CRM_TH}>
                Status
              </th>
              <th scope="col" className={CRM_TH}>
                Source
              </th>
              <th scope="col" className={CRM_TH}>
                Orders
              </th>
              <th scope="col" className={CRM_TH}>
                Last Visit
              </th>
              <th scope="col" className={`${CRM_TH} text-right`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((customer) => {
              const fullName =
                customer.full_name ??
                `${customer.first_name} ${customer.last_name ?? ""}`.trim();
              const statusLabel = getStatusLabel(customer);
              return (
                <tr
                  key={customer.id}
                  className="cursor-pointer odd:bg-gray-50 even:bg-white"
                  onClick={() => router.push(`/customers/${customer.id}`)}
                >
                  <td title={fullName || undefined} className={`${CRM_TD} font-medium`}>
                    {fullName || "—"}
                  </td>
                  <td className={CRM_TD}>
                    {customer.phone_primary ? (
                      <a
                        href={`tel:${customer.phone_primary.replace(/\s/g, "")}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-primary hover:underline"
                      >
                        {customer.phone_primary}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td title={customer.email ?? undefined} className={CRM_TD}>
                    {customer.email ? (
                      <a
                        href={`mailto:${customer.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-primary hover:underline"
                      >
                        {customer.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td title={statusLabel} className={CRM_TD}>
                    {statusLabel}
                  </td>
                  <td
                    title={getSourceLabel(customer) || undefined}
                    className={`${CRM_TD} text-muted-foreground`}
                  >
                    {getSourceLabel(customer) || "—"}
                  </td>
                  <td className={`${CRM_TD} tabular-nums`}>
                    {customer.total_orders != null ? String(customer.total_orders) : "—"}
                  </td>
                  <td className={`${CRM_TD} tabular-nums`}>
                    {customer.last_visit_date
                      ? new Date(customer.last_visit_date).toLocaleDateString()
                      : "—"}
                  </td>
                  <td
                    className={`${CRM_TD} overflow-hidden text-right`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}`)}>
                          View
                        </DropdownMenuItem>
                        {canEditCustomer && (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditCustomer(customer);
                              setEditOpen(true);
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                        )}
                        {canDeleteCustomer && (
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Customers</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : pluralize(filteredCustomers.length, "contact")}
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
          {canCreateCustomer && (
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
                {soldCustomers.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads">
            Leads
            {!loading && (
              <Badge variant="secondary" className="ml-2">
                {exclusiveLeadCustomers.length}
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
                {loading ? "Loading..." : pluralize(filteredCustomers.length, "contact")}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : filteredCustomers.length === 0 ? (
                customers.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-muted-foreground">No customers yet.</p>
                    <Button asChild size="sm">
                      <Link href="/customers/add">
                        <Plus className="mr-2 size-4" />
                        Add your first customer
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-muted-foreground">
                      No customers match your filters or search.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                        setSourceFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                )
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
                {soldLoading
                  ? "Loading..."
                  : `${pluralize(soldCustomers.length, "customer")} with sold cars (converted)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              {soldLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : soldCustomers.length === 0 ? (
                <p className="text-muted-foreground">No sold cars found.</p>
              ) : (
                <div className="scrollbar-thick w-full min-w-0 max-h-[min(72vh,calc(100dvh-14rem))] overflow-x-auto overflow-y-auto rounded-md border border-border bg-card [-webkit-overflow-scrolling:touch]">
                  <table className="w-max min-w-full table-fixed border-collapse">
                    <colgroup>
                      {SOLD_TABLE_COL_PX.map((w, i) => (
                        <col key={i} style={{ width: `${w}px` }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col" className={CRM_TH}>
                          Vehicle
                        </th>
                        <th scope="col" className={`${CRM_TH} font-mono`}>
                          VIN
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Color
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Customer
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Phone
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Price
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Date bought
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Delivery Date
                        </th>
                        <th scope="col" className={CRM_TH}>
                          Order Status
                        </th>
                        <th scope="col" className={`${CRM_TH} text-right`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {convertedSoldCars.map((so) => {
                        const car = so.cars;
                        const customer = so.customers;
                        const fullName = customer
                          ? `${customer.first_name} ${customer.last_name ?? ""}`.trim()
                          : "—";
                        const dateBoughtDisplay = so.date_bought ?? so.sale_date;
                        const vehicleTitle = car
                          ? `${car.brand} ${car.model}${car.model_year ? ` (${car.model_year})` : ""}`
                          : "—";
                        const orderStatusText = so.status ?? "—";
                        return (
                          <tr key={so.id} className="odd:bg-gray-50 even:bg-white">
                            <td title={vehicleTitle} className={`${CRM_TD} font-medium`}>
                              {vehicleTitle}
                            </td>
                            <td
                              title={car?.vin ?? ""}
                              className={`${CRM_TD} font-mono text-[10px] text-muted-foreground`}
                            >
                              {car?.vin ?? "—"}
                            </td>
                            <td
                              title={car?.exterior_color ?? undefined}
                              className={`${CRM_TD} text-muted-foreground`}
                            >
                              {car?.exterior_color ?? "—"}
                            </td>
                            <td className={CRM_TD}>
                              {customer ? (
                                <button
                                  type="button"
                                  className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-primary hover:underline"
                                  onClick={() => router.push(`/customers/${customer.id}`)}
                                >
                                  {fullName}
                                </button>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className={CRM_TD}>
                              {customer?.phone_primary ? (
                                <a
                                  href={`tel:${customer.phone_primary}`}
                                  className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-primary hover:underline"
                                >
                                  {customer.phone_primary}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className={`${CRM_TD} tabular-nums`}>
                              {so.selling_price != null
                                ? `${Number(so.selling_price).toLocaleString()} ${so.currency ?? "USD"}`
                                : "—"}
                            </td>
                            <td className={`${CRM_TD} tabular-nums`}>
                              {dateBoughtDisplay
                                ? new Date(dateBoughtDisplay).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className={`${CRM_TD} tabular-nums`}>
                              {so.delivery_date
                                ? new Date(so.delivery_date).toLocaleDateString()
                                : "—"}
                            </td>
                            <td title={orderStatusText} className={CRM_TD}>
                              {orderStatusText}
                            </td>
                            <td className={`${CRM_TD} overflow-hidden text-right`}>
                              <span className="inline-flex max-w-full flex-nowrap items-center justify-end gap-0.5 overflow-hidden">
                                {customer && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 shrink-0 px-1.5 text-[10px]"
                                    onClick={() => router.push(`/customers/${customer.id}`)}
                                  >
                                    Cust.
                                  </Button>
                                )}
                                {car && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 shrink-0 px-1.5 text-[10px]"
                                    onClick={() =>
                                      router.push(`/cars/${encodeURIComponent(car.vin ?? so.car_id)}`)
                                    }
                                  >
                                    Car
                                  </Button>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
              <CardDescription>
                {loading ? "Loading..." : pluralize(exclusiveLeadCustomers.length, "lead contact")}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              {loading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : exclusiveLeadCustomers.length === 0 ? (
                <div className="flex flex-col items-start gap-3 py-2">
                  <p className="text-muted-foreground">
                    No leads yet. New customers added with a status other than
                    &ldquo;Converted&rdquo; show up here.
                  </p>
                  {canCreateCustomer && (
                    <Button asChild size="sm">
                      <Link href="/customers/add">Add a lead</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <CustomerTable list={exclusiveLeadCustomers} />
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
