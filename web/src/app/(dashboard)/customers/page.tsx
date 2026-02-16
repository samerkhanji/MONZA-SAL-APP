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
  LANGUAGE_LABELS,
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

function matchesSearch(customer: CustomerDisplay, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const fullName = (customer.full_name ?? `${customer.first_name} ${customer.last_name ?? ""}`.trim()).toLowerCase();
  const phone = (customer.phone_primary ?? "").toLowerCase();
  const email = (customer.email ?? "").toLowerCase();
  const company = (customer.company ?? "").toLowerCase();
  return (
    fullName.includes(q) ||
    phone.includes(q) ||
    email.includes(q) ||
    company.includes(q)
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const { canEditInventory, canDelete } = useUser();
  const [customers, setCustomers] = useState<CustomerDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
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

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!matchesSearch(c, search)) return false;
      if (statusFilter !== "all" && c.lead_status !== statusFilter) return false;
      if (sourceFilter !== "all" && c.lead_source !== sourceFilter) return false;
      if (languageFilter !== "all" && (c.preferred_language ?? "en") !== languageFilter) return false;
      return true;
    });
  }, [customers, search, statusFilter, sourceFilter, languageFilter]);

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
    router.push("/customers");
    fetchCustomers();
  }

  function getStatusLabel(c: CustomerDisplay): string {
    return c.status_display ?? LEAD_STATUS_LABELS[c.lead_status] ?? c.lead_status;
  }

  function getSourceLabel(c: CustomerDisplay): string {
    return c.source_display ?? (c.lead_source ? LEAD_SOURCE_LABELS[c.lead_source] : "") ?? "—";
  }

  return (
    <div className="container mx-auto max-w-[1600px] space-y-6 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customers & Leads</h1>
          <p className="text-muted-foreground">
            {loading ? "Loading..." : `${filteredCustomers.length} contact(s)`}
          </p>
        </div>
        {canEditInventory && (
          <Button asChild>
            <Link href="/customers/add">Add Customer</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by name, phone, email, company · Status · Source · Language
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Input
            placeholder="Search name, phone, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const statusClass =
                      LEAD_STATUS_COLORS[customer.lead_status] ??
                      "bg-muted text-muted-foreground";
                    const fullName =
                      customer.full_name ??
                      `${customer.first_name} ${customer.last_name ?? ""}`.trim();

                    return (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/customers/${customer.id}`)}
                      >
                        <TableCell className="font-medium">
                          {fullName || "—"}
                        </TableCell>
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
                          <Badge className={statusClass}>
                            {getStatusLabel(customer)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getSourceLabel(customer) || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {customer.company ?? "—"}
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
          )}
        </CardContent>
      </Card>

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
              Are you sure you want to remove this customer? This action can be
              undone by an admin.
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
