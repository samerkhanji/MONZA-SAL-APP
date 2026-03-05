"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay, CarStatus } from "@/types/database";
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
  const [newStatus, setNewStatus] = useState<CarStatus>("in_stock");
  const [sellingPrice, setSellingPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentType, setPaymentType] = useState<"full" | "installments">("full");
  const [planTotalAmount, setPlanTotalAmount] = useState("");
  const [planDownPayment, setPlanDownPayment] = useState("");
  const [planMonths, setPlanMonths] = useState("");
  const [planMonthlyAmount, setPlanMonthlyAmount] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planDueDay, setPlanDueDay] = useState("");

  const isSoldOrReserved = car && (car.status === "sold" || car.status === "reserved");

  useEffect(() => {
    if (!open || !car) return;

    setNewStatus(car.status);
    setPlateNumber(car.plate_number ?? "");
    setSubDealerName(car.sub_dealer_name ?? "");

    // Reset payment plan fields on open
    setPaymentType("full");
    setPlanTotalAmount("");
    setPlanDownPayment("");
    setPlanMonths("");
    setPlanMonthlyAmount("");
    setPlanStartDate("");
    setPlanDueDay("");

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
            setSellingPrice(saleData.selling_price != null ? String(saleData.selling_price) : "");
            setCurrency(saleData.currency ?? "USD");
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
            setNewStatus(car.status === "reserved" ? "reserved" : "sold");
            if ((car as { client_name?: string }).client_name) {
              const parts = (car as { client_name: string }).client_name.trim().split(/\s+/);
              setFirstName(parts[0] ?? "");
              setLastName(parts.slice(1).join(" ") ?? "");
            }
            if ((car as { client_phone?: string }).client_phone) {
              setPhone((car as { client_phone: string }).client_phone);
            }
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
  }, [open, car, isSoldOrReserved]);

  useEffect(() => {
    const total = parseFloat(planTotalAmount || "0");
    const down = parseFloat(planDownPayment || "0");
    const months = parseInt(planMonths || "0", 10);
    if (total > 0 && months > 0 && down >= 0 && down <= total) {
      const base = (total - down) / months;
      if (!Number.isNaN(base) && base > 0) {
        if (!planMonthlyAmount || Number(planMonthlyAmount) === 0) {
          setPlanMonthlyAmount(base.toFixed(2));
        }
      }
    }
  }, [planTotalAmount, planDownPayment, planMonths]);

  const needsCustomer = newStatus === "reserved" || newStatus === "sold";
  const showPlateField = ["sold", "delivered", "registered"].includes(newStatus);

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
        // Safeguard: Check if this car is already linked to another customer
        const { data: existingSale } = await supabase
          .from("sales_orders")
          .select("id, customer_id, customers(first_name, last_name)")
          .eq("car_id", car.id)
          .not("status", "eq", "cancelled")
          .limit(1)
          .maybeSingle();

        if (existingSale?.customer_id) {
          const other = existingSale.customers as { first_name?: string; last_name?: string } | null;
          const otherName = other ? `${other.first_name ?? ""} ${other.last_name ?? ""}`.trim() : "another customer";
          setSubmitting(false);
          toast.error(`This car is already linked to ${otherName}. Remove that link first if you need to reassign.`);
          return;
        }

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

        if (newStatus === "sold" && paymentType === "installments") {
          const totalNum = parseFloat(planTotalAmount || sellingPrice || "0");
          const downNum = parseFloat(planDownPayment || "0");
          const monthsNum = parseInt(planMonths || "0", 10);
          const monthlyNum = parseFloat(planMonthlyAmount || "0");
          const dueDayNum = parseInt(planDueDay || "0", 10);

          if (!planStartDate) {
            setSubmitting(false);
            toast.error("Start date is required for installments.");
            return;
          }
          if (!(totalNum > 0)) {
            setSubmitting(false);
            toast.error("Total amount must be greater than 0.");
            return;
          }
          if (downNum < 0 || downNum > totalNum) {
            setSubmitting(false);
            toast.error("Down payment must be between 0 and total amount.");
            return;
          }
          if (!(monthsNum > 0)) {
            setSubmitting(false);
            toast.error("Number of months must be greater than 0.");
            return;
          }
          if (!(monthlyNum > 0)) {
            setSubmitting(false);
            toast.error("Monthly amount must be greater than 0.");
            return;
          }
          if (dueDayNum < 1 || dueDayNum > 28) {
            setSubmitting(false);
            toast.error("Due day must be between 1 and 28.");
            return;
          }

          const { data: planData, error: planError } = await supabase
            .from("payment_plans")
            .insert({
              customer_id: newCustomer.id,
              car_id: car.id,
              status: "active",
              total_amount: totalNum,
              down_payment: downNum,
              monthly_amount: monthlyNum,
              months: monthsNum,
              start_date: planStartDate,
              due_day: dueDayNum,
              created_by: user.id,
            })
            .select("id")
            .single();

          if (planError || !planData?.id) {
            setSubmitting(false);
            toast.error("Sale created but failed to create payment plan: " + (planError?.message ?? "Unknown error"));
            return;
          }

          const installments: Record<string, unknown>[] = [];
          const baseDate = new Date(planStartDate);

          if (downNum > 0) {
            installments.push({
              plan_id: planData.id,
              installment_no: 0,
              due_date: planStartDate,
              amount_due: downNum,
              status: "paid",
              paid_at: new Date().toISOString(),
              paid_amount: downNum,
            });
          }

          for (let i = 0; i < monthsNum; i += 1) {
            const d = new Date(baseDate);
            d.setMonth(d.getMonth() + i);
            d.setDate(dueDayNum);
            const dueDateStr = d.toISOString().split("T")[0];
            installments.push({
              plan_id: planData.id,
              installment_no: i + 1,
              due_date: dueDateStr,
              amount_due: monthlyNum,
              status: "upcoming",
            });
          }

          const { error: instError } = await supabase
            .from("installment_payments")
            .insert(installments);

          if (instError) {
            setSubmitting(false);
            toast.error("Plan created but failed to create installments: " + instError.message);
            return;
          }
        }
      }
    }

    // Always update the car's status on the cars table
    const carStatusPayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === "sent_to_sub_dealer") {
      carStatusPayload.sub_dealer_name = subDealerName.trim() || null;
    } else {
      carStatusPayload.sub_dealer_name = null;
    }
    const { error: carError } = await supabase
      .from("cars")
      .update(carStatusPayload)
      .eq("id", car.id);

    if (carError) {
      setSubmitting(false);
      toast.error("Failed to update status: " + carError.message);
      return;
    }

    if (showPlateField && plateNumber.trim() !== (car.plate_number ?? "")) {
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
            {isSoldOrReserved
              ? "Customer details"
              : needsCustomer
                ? "Add customer & set status"
                : "Set status"}
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
                    {showPlateField && (
                      <div className="space-y-2">
                        <Label>Number plate</Label>
                        <Input
                          value={plateNumber}
                          onChange={(e) => setPlateNumber(e.target.value)}
                          placeholder="Car plate number"
                        />
                      </div>
                    )}
                    {sale && (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="font-medium">Sale info</p>
                        <p className="text-muted-foreground">
                          Price: {sale.selling_price != null ? `${sale.selling_price} ${sale.currency ?? "USD"}` : "—"}
                        </p>
                        {sale.delivery_date && (
                          <p className="text-muted-foreground">
                            Delivery: {new Date(sale.delivery_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Name:</span> {firstName} {lastName}</p>
                    <p><span className="font-medium">Phone:</span> {phone}</p>
                    {phone2 && <p><span className="font-medium">Phone 2:</span> {phone2}</p>}
                    {email && <p><span className="font-medium">Email:</span> {email}</p>}
                    {showPlateField && <p><span className="font-medium">Plate:</span> {car.plate_number ?? "—"}</p>}
                    {sale?.selling_price != null && (
                      <p><span className="font-medium">Price:</span> {sale.selling_price} {sale.currency ?? "USD"}</p>
                    )}
                  </div>
                )}
              </>
            ) : isSoldOrReserved && !customer ? (
              canEditInventory ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-sm">Link an existing customer or add a new one.</p>
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
                  {showPlateField && (
                    <div className="space-y-2">
                      <Label>Number plate</Label>
                      <Input
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="Car plate number"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Selling price</Label>
                    <Input
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      type="number"
                      min={0}
                      placeholder="Optional"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => void handleSaveCustomer()} disabled={submitting || !firstName.trim() || !phone.trim()}>
                      {submitting ? "Saving..." : "Link customer"}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <p className="text-muted-foreground">No customer linked. Contact admin.</p>
              )
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
                        <SelectItem value="inbound">Inbound</SelectItem>
                        <SelectItem value="in_stock">Available</SelectItem>
                        <SelectItem value="showroom">Showroom</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="service">Service</SelectItem>
                        <SelectItem value="sent_to_sub_dealer">Sent to Dealership</SelectItem>
                        <SelectItem value="demo">Display</SelectItem>
                        <SelectItem value="registered">Registered</SelectItem>
                        <SelectItem value="under_registration">Under Registration</SelectItem>
                        <SelectItem value="sent_to_customs">Sent to Customs</SelectItem>
                        <SelectItem value="company_car">Company Car</SelectItem>
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
                  ) : showPlateField ? (
                    <div className="space-y-2">
                      <Label>Number plate</Label>
                      <Input
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="Car plate number"
                      />
                    </div>
                  ) : null}
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
                      {newStatus === "sold" && (
                        <div className="space-y-3 rounded-md border p-3">
                          <p className="text-sm font-medium">Payment Type</p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label>Payment type</Label>
                              <Select
                                value={paymentType}
                                onValueChange={(v) =>
                                  setPaymentType(v as "full" | "installments")
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full">Full</SelectItem>
                                  <SelectItem value="installments">
                                    Installments
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {paymentType === "installments" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Total amount *</Label>
                                <Input
                                  value={planTotalAmount}
                                  onChange={(e) => setPlanTotalAmount(e.target.value)}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="Full car price"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Down payment</Label>
                                <Input
                                  value={planDownPayment}
                                  onChange={(e) => setPlanDownPayment(e.target.value)}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0 if none"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Number of months *</Label>
                                <Input
                                  value={planMonths}
                                  onChange={(e) => setPlanMonths(e.target.value)}
                                  type="number"
                                  min={1}
                                  step={1}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Monthly amount *</Label>
                                <Input
                                  value={planMonthlyAmount}
                                  onChange={(e) => setPlanMonthlyAmount(e.target.value)}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Start date *</Label>
                                <Input
                                  value={planStartDate}
                                  onChange={(e) => setPlanStartDate(e.target.value)}
                                  type="date"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Due day (1–28) *</Label>
                                <Input
                                  value={planDueDay}
                                  onChange={(e) => setPlanDueDay(e.target.value)}
                                  type="number"
                                  min={1}
                                  max={28}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
