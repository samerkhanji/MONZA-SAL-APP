"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay } from "@/types/database";
import { CAR_STATUS_LABELS } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomerData {
  id: string;
  first_name: string;
  last_name: string | null;
  phone_primary: string;
  phone_secondary: string | null;
  email: string | null;
}

interface SaleData {
  id: string;
  customer_id: string;
  status: string;
  selling_price: number | null;
  currency: string | null;
  sale_date: string | null;
  delivery_date: string | null;
  reserved_until: string | null;
  deposit_amount: number | null;
}

interface StatusCustomerDialogProps {
  car: CarDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function StatusCustomerDialog({
  car,
  open,
  onOpenChange,
  onSuccess,
}: StatusCustomerDialogProps) {
  const { canEditInventory } = useUser();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [sale, setSale] = useState<SaleData | null>(null);

  // Form state (for add or edit)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [email, setEmail] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [subDealerName, setSubDealerName] = useState("");
  const [newStatus, setNewStatus] = useState<"in_stock" | "reserved" | "sold" | "sent_to_sub_dealer" | "demo">("in_stock");
  const [sellingPrice, setSellingPrice] = useState("");
  const [currency, setCurrency] = useState("USD");

  const isSoldOrReserved = car && (car.status === "sold" || car.status === "reserved");

  useEffect(() => {
    if (!open || !car) return;

    setPlateNumber(car.plate_number ?? "");
    setSubDealerName(car.sub_dealer_name ?? "");

    if (isSoldOrReserved) {
      setLoading(true);
      (async () => {
        try {
          const { data: saleData } = await supabase
            .from("sales_orders")
            .select("id, customer_id, status, selling_price, currency, sale_date, delivery_date, reserved_until, deposit_amount")
            .eq("car_id", car.id)
            .not("status", "eq", "cancelled")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (saleData?.customer_id) {
            const { data: custData } = await supabase
              .from("customers")
              .select("id, first_name, last_name, phone_primary, phone_secondary, email")
              .eq("id", saleData.customer_id)
              .single();

            setSale(saleData as SaleData);
            setCustomer(custData as CustomerData | null);
            if (custData) {
              setFirstName(custData.first_name);
              setLastName(custData.last_name ?? "");
              setPhone(custData.phone_primary);
              setPhone2(custData.phone_secondary ?? "");
              setEmail(custData.email ?? "");
            }
          } else {
            setSale(null);
            setCustomer(null);
          }
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setCustomer(null);
      setSale(null);
      setFirstName("");
      setLastName("");
      setPhone("");
      setPhone2("");
      setEmail("");
      setSellingPrice("");
      setCurrency("USD");
    }
  }, [open, car?.id, isSoldOrReserved]);

  const needsCustomer = newStatus === "reserved" || newStatus === "sold";

  async function handleSaveCustomer() {
    if (!car || !canEditInventory) return;
    if (needsCustomer && (!firstName.trim() || !phone.trim())) {
      toast.error("First name and phone are required for Reserved or Sold");
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      toast.error("Not authenticated");
      return;
    }

    if (needsCustomer) {
      if (customer) {
        const { error: custError } = await supabase
          .from("customers")
          .update({
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone_primary: phone.trim(),
            phone_secondary: phone2.trim() || null,
            email: email.trim() || null,
          })
          .eq("id", customer.id);

        if (custError) {
          setSubmitting(false);
          toast.error("Failed to update customer: " + custError.message);
          return;
        }
      } else {
        const { data: newCustomer, error: custError } = await supabase
          .from("customers")
          .insert({
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            phone_primary: phone.trim(),
            phone_secondary: phone2.trim() || null,
            email: email.trim() || null,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (custError || !newCustomer?.id) {
          setSubmitting(false);
          toast.error("Failed to create customer: " + (custError?.message ?? "Unknown error"));
          return;
        }

        const saleStatus = newStatus === "sold" ? "confirmed" : "reserved";
        const salePayload: Record<string, unknown> = {
          car_id: car.id,
          customer_id: newCustomer.id,
          status: saleStatus,
          created_by: user.id,
        };
        const priceNum = sellingPrice ? parseFloat(sellingPrice) : undefined;
        if (priceNum !== undefined && !Number.isNaN(priceNum)) salePayload.selling_price = priceNum;
        salePayload.currency = currency;

        const { error: saleError } = await supabase
          .from("sales_orders")
          .insert(salePayload);

        if (saleError) {
          setSubmitting(false);
          toast.error("Failed to create sale: " + saleError.message);
          return;
        }
      }
    } else {
      // Status-only update (in_stock, sent_to_sub_dealer, demo)
      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (newStatus === "sent_to_sub_dealer") {
        updatePayload.sub_dealer_name = subDealerName.trim() || null;
      } else {
        updatePayload.sub_dealer_name = null;
      }
      const { error: carError } = await supabase
        .from("cars")
        .update(updatePayload)
        .eq("id", car.id);

      if (carError) {
        setSubmitting(false);
        toast.error("Failed to update status: " + carError.message);
        return;
      }
    }

    if (newStatus !== "sent_to_sub_dealer" && plateNumber.trim() !== (car.plate_number ?? "")) {
      await supabase
        .from("cars")
        .update({ plate_number: plateNumber.trim() || null })
        .eq("id", car.id);
    }

    setSubmitting(false);
    toast.success(needsCustomer ? (customer ? "Customer updated" : "Customer added") : "Status updated");
    onSuccess();
    onOpenChange(false);
  }

  if (!car) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isSoldOrReserved ? "Customer details" : "Add customer & set status"}
          </DialogTitle>
          <DialogDescription>
            {car.brand} {car.model} — VIN: <span className="font-mono">{car.vin_short ?? car.vin?.slice(-8)}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-4">
            {isSoldOrReserved && customer ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Status: {CAR_STATUS_LABELS[car.status]}
                </p>
                {canEditInventory ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>First name</Label>
                        <Input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Required"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last name</Label>
                        <Input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Phone *</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          type="tel"
                          placeholder="Required"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone 2</Label>
                        <Input
                          value={phone2}
                          onChange={(e) => setPhone2(e.target.value)}
                          type="tel"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Number plate</Label>
                      <Input
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="Car plate number"
                      />
                    </div>
                    {sale && (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Sale info</p>
                        <p className="text-muted-foreground">
                          Price: {sale.selling_price != null ? `${sale.selling_price} ${sale.currency ?? "USD"}` : "—"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Name:</span> {firstName} {lastName}</p>
                    <p><span className="font-medium">Phone:</span> {phone}</p>
                    {phone2 && <p><span className="font-medium">Phone 2:</span> {phone2}</p>}
                    {email && <p><span className="font-medium">Email:</span> {email}</p>}
                    <p><span className="font-medium">Plate:</span> {car.plate_number ?? "—"}</p>
                    {sale?.selling_price != null && (
                      <p><span className="font-medium">Price:</span> {sale.selling_price} {sale.currency ?? "USD"}</p>
                    )}
                  </div>
                )}
              </>
            ) : isSoldOrReserved && !customer ? (
              <p className="text-muted-foreground">No customer linked. Contact admin.</p>
            ) : (
              canEditInventory && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Set status to</Label>
                    <Select value={newStatus} onValueChange={(v) => setNewStatus(v as typeof newStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_stock">In Stock</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="sent_to_sub_dealer">Sent to Sub Dealer</SelectItem>
                        <SelectItem value="demo">Demo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newStatus === "sent_to_sub_dealer" ? (
                    <div className="space-y-2">
                      <Label>Sub dealer</Label>
                      <Input
                        value={subDealerName}
                        onChange={(e) => setSubDealerName(e.target.value)}
                        placeholder="Which sub dealer?"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Number plate</Label>
                      <Input
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="Car plate number"
                      />
                    </div>
                  )}
                  {needsCustomer && (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>First name *</Label>
                          <Input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Required"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Last name</Label>
                          <Input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Phone *</Label>
                          <Input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            type="tel"
                            placeholder="Required"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Phone 2</Label>
                          <Input
                            value={phone2}
                            onChange={(e) => setPhone2(e.target.value)}
                            type="tel"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          type="email"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Selling price</Label>
                          <Input
                            value={sellingPrice}
                            onChange={(e) => setSellingPrice(e.target.value)}
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Currency</Label>
                          <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="AED">AED</SelectItem>
                              <SelectItem value="LBP">LBP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {!loading && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {canEditInventory && (customer || !isSoldOrReserved) && (
              <Button onClick={handleSaveCustomer} disabled={submitting}>
                {submitting
                  ? "Saving..."
                  : customer
                    ? "Save changes"
                    : needsCustomer
                      ? "Add customer"
                      : "Update status"}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
