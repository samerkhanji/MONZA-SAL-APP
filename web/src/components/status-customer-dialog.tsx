"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import type { CarDisplay, CarStatus } from "@/types/database";
import { formatCarStatusLabel } from "@/types/database";
import { installmentDueDateIso } from "@/lib/installment-due-dates";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { monzaWarrantySlotsEmpty, warrantyExpiryFromDeliveryYmd } from "@/lib/warranty-from-delivery";

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
  date_bought?: string | null;
  delivery_date: string | null;
  reservation_date?: string | null;
  reserved_until: string | null;
  deposit_amount: number | null;
}

interface StatusCustomerDialogProps {
  car: CarDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** When opening from a quick status control, pre-select this target status in the dialog. */
  presetTargetStatus?: CarStatus | null;
}

export function StatusCustomerDialog({
  car,
  open,
  onOpenChange,
  onSuccess,
  presetTargetStatus = null,
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
  const [newStatus, setNewStatus] = useState<CarStatus>("available");
  const [sellingPrice, setSellingPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentType, setPaymentType] = useState<"full" | "installments">("full");
  const [planTotalAmount, setPlanTotalAmount] = useState("");
  const [planDownPayment, setPlanDownPayment] = useState("");
  const [planMonths, setPlanMonths] = useState("");
  const [planMonthlyAmount, setPlanMonthlyAmount] = useState("");
  const [planStartDate, setPlanStartDate] = useState("");
  const [planDueDay, setPlanDueDay] = useState("");
  const [dateBought, setDateBought] = useState("");
  const [reservationDateStr, setReservationDateStr] = useState("");
  const [deliveryDateStr, setDeliveryDateStr] = useState("");
  const [warrantyDeliveryConfirmOpen, setWarrantyDeliveryConfirmOpen] = useState(false);
  const skipWarrantyDeliveryConfirmRef = useRef(false);

  const isSoldOrReserved = car && (car.status === "sold" || car.status === "reserved");

  function normalizeOptionalDateForDb(value: string): string | null {
    const t = value.trim();
    return t.length === 0 ? null : t;
  }

  function validateOptionalIsoDate(value: string, label: string): string | null {
    const t = value.trim();
    if (!t) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return `${label}: use YYYY-MM-DD.`;
    if (Number.isNaN(Date.parse(`${t}T12:00:00`))) return `${label}: invalid date.`;
    return null;
  }

  useEffect(() => {
    if (!open || !car) return;

    setNewStatus(presetTargetStatus ?? car.status);
    setPlateNumber(car.plate_number ?? "");

    // Reset payment plan fields on open
    setPaymentType("full");
    setPlanTotalAmount("");
    setPlanDownPayment("");
    setPlanMonths("");
    setPlanMonthlyAmount("");
    setPlanStartDate("");
    setPlanDueDay("");
    setDateBought("");
    setReservationDateStr("");
    setDeliveryDateStr("");

    if (isSoldOrReserved) {
      setLoading(true);
      (async () => {
        try {
          const { data: saleData } = await supabase
            .from("sales_orders")
            .select(
              "id, customer_id, status, selling_price, currency, sale_date, date_bought, delivery_date, reservation_date, reserved_until, deposit_amount"
            )
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
            const bought =
              (saleData as { date_bought?: string | null }).date_bought ??
              car.date_bought ??
              (saleData as { sale_date?: string | null }).sale_date;
            setDateBought(bought ? String(bought).slice(0, 10) : "");
            const resD = (saleData as { reservation_date?: string | null }).reservation_date;
            const delD = (saleData as { delivery_date?: string | null }).delivery_date;
            setReservationDateStr(
              resD ? String(resD).slice(0, 10) : car.reservation_date ? String(car.reservation_date).slice(0, 10) : ""
            );
            setDeliveryDateStr(
              delD ? String(delD).slice(0, 10) : car.delivery_date ? String(car.delivery_date).slice(0, 10) : ""
            );
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
            const displayBought = car.date_bought
              ? String(car.date_bought).slice(0, 10)
              : "";
            setDateBought(displayBought);
            setReservationDateStr(
              car.reservation_date ? String(car.reservation_date).slice(0, 10) : ""
            );
            setDeliveryDateStr(car.delivery_date ? String(car.delivery_date).slice(0, 10) : "");
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
      setDeliveryDateStr(
        car.delivery_date ? String(car.delivery_date).slice(0, 10) : ""
      );
    }
  }, [open, car, isSoldOrReserved, presetTargetStatus]);

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
  const showPlateField = newStatus === "sold";

  async function handleSaveCustomer() {
    if (!car || !canEditInventory) return;
    if (needsCustomer && (!firstName.trim() || !phone.trim())) {
      toast.error("First name and phone are required for Reserved or Sold");
      return;
    }

    for (const msg of [
      validateOptionalIsoDate(dateBought, "Date Bought"),
      validateOptionalIsoDate(reservationDateStr, "Reservation date"),
      validateOptionalIsoDate(deliveryDateStr, "Delivery date"),
    ]) {
      if (msg) {
        toast.error(msg);
        return;
      }
    }

    const dbDeliveryPreview = normalizeOptionalDateForDb(deliveryDateStr);
    if (
      !skipWarrantyDeliveryConfirmRef.current &&
      newStatus === "sold" &&
      car.status !== "sold" &&
      dbDeliveryPreview &&
      monzaWarrantySlotsEmpty(car)
    ) {
      setWarrantyDeliveryConfirmOpen(true);
      return;
    }
    skipWarrantyDeliveryConfirmRef.current = false;

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

        const dbBought = normalizeOptionalDateForDb(dateBought);
        const dbReservation = normalizeOptionalDateForDb(reservationDateStr);
        const dbDelivery = normalizeOptionalDateForDb(deliveryDateStr);
        const { data: latestSo } = await supabase
          .from("sales_orders")
          .select("id")
          .eq("car_id", car.id)
          .not("status", "eq", "cancelled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestSo?.id) {
          const { error: saleUpdErr } = await supabase
            .from("sales_orders")
            .update({
              date_bought: dbBought,
              reservation_date: dbReservation,
              delivery_date: dbDelivery,
            })
            .eq("id", latestSo.id);
          if (saleUpdErr) {
            setSubmitting(false);
            toast.error("Failed to update sales order dates: " + saleUpdErr.message);
            return;
          }
        } else if (customer.id) {
          if (dbBought || dbReservation || dbDelivery) {
            const { error: saleInsErr } = await supabase.from("sales_orders").insert({
              car_id: car.id,
              customer_id: customer.id,
              status: car.status === "reserved" ? "reserved" : "confirmed",
              created_by: user.id,
              currency: currency || "USD",
              date_bought: dbBought,
              reservation_date: dbReservation,
              delivery_date: dbDelivery,
            });
            if (saleInsErr) {
              setSubmitting(false);
              toast.error("Failed to save sales order dates: " + saleInsErr.message);
              return;
            }
          }
        } else if (dbBought || dbReservation || dbDelivery) {
          setSubmitting(false);
          toast.error("Link a customer before setting sales order dates.");
          return;
        }
      } else {
        // Safeguard: Check if this car is already linked to another customer
        const { data: existingSale } = await supabase
          .from("sales_orders")
          .select("id, customer_id, customers(first_name, last_name)")
          .eq("car_id", car.id)
          .not("status", "eq", "cancelled")
          .order("created_at", { ascending: false })
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
        const dbBought = normalizeOptionalDateForDb(dateBought);
        const dbReservation = normalizeOptionalDateForDb(reservationDateStr);
        const dbDelivery = normalizeOptionalDateForDb(deliveryDateStr);
        salePayload.date_bought = dbBought;
        salePayload.reservation_date = dbReservation;
        salePayload.delivery_date = dbDelivery;

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
          if (dueDayNum < 1 || dueDayNum > 31) {
            setSubmitting(false);
            toast.error("Due day must be between 1 and 31.");
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
              interest_rate: 0,
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

          const startYmd = planStartDate;
          for (let i = 0; i < monthsNum; i += 1) {
            const dueDateStr = installmentDueDateIso(startYmd, i, dueDayNum);
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

    const dbDeliveryForSimple = normalizeOptionalDateForDb(deliveryDateStr);
    let deliveryWrittenToCarRowOnly = false;
    if (!needsCustomer && dbDeliveryForSimple) {
      const { data: lo } = await supabase
        .from("sales_orders")
        .select("id")
        .eq("car_id", car.id)
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lo?.id) {
        const { error: delErr } = await supabase
          .from("sales_orders")
          .update({ delivery_date: dbDeliveryForSimple })
          .eq("id", lo.id);
        if (delErr) {
          setSubmitting(false);
          toast.error("Failed to update delivery date: " + delErr.message);
          return;
        }
      } else {
        deliveryWrittenToCarRowOnly = true;
      }
    }

    // Always update the car's status on the cars table
    const carStatusPayload: Record<string, unknown> = {
      status: newStatus,
      sub_dealer_name: null,
    };
    if (deliveryWrittenToCarRowOnly) {
      carStatusPayload.delivery_date = dbDeliveryForSimple;
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

  const previewDelivery = normalizeOptionalDateForDb(deliveryDateStr);
  const previewV =
    previewDelivery && warrantyExpiryFromDeliveryYmd(previewDelivery, 5);
  const previewB =
    previewDelivery && warrantyExpiryFromDeliveryYmd(previewDelivery, 8);

  return (
    <>
    <AlertDialog
      open={warrantyDeliveryConfirmOpen}
      onOpenChange={(o) => {
        if (!o) skipWarrantyDeliveryConfirmRef.current = false;
        setWarrantyDeliveryConfirmOpen(o);
      }}
    >
      <AlertDialogContent className="border-border sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Start warranty from delivery date?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              Monza warranty will start from{" "}
              <strong>
                {previewDelivery
                  ? new Date(`${previewDelivery}T12:00:00`).toLocaleDateString()
                  : "—"}
              </strong>
              . Vehicle coverage to{" "}
              <strong>{previewV || "—"}</strong> (5 years) and battery to{" "}
              <strong>{previewB || "—"}</strong> (8 years), only where fields are still empty.
            </span>
            <span className="text-muted-foreground block text-xs">
              Existing warranty dates are never overwritten. You can change them later if you have permission.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-500 text-amber-950 hover:bg-amber-400 dark:bg-amber-500 dark:text-amber-950"
            onClick={() => {
              skipWarrantyDeliveryConfirmRef.current = true;
              setWarrantyDeliveryConfirmOpen(false);
              void handleSaveCustomer();
            }}
          >
            Save &amp; apply warranty dates
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
                  Status: {formatCarStatusLabel(car.status)}
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="status-dialog-reservation">Reservation date</Label>
                        <Input
                          id="status-dialog-reservation"
                          type="date"
                          value={reservationDateStr}
                          onChange={(e) => setReservationDateStr(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status-dialog-delivery">Delivery date</Label>
                        <Input
                          id="status-dialog-delivery"
                          type="date"
                          value={deliveryDateStr}
                          onChange={(e) => setDeliveryDateStr(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status-dialog-date-bought">Date Bought</Label>
                        <Input
                          id="status-dialog-date-bought"
                          type="date"
                          value={dateBought}
                          onChange={(e) => setDateBought(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Writes <span className="font-mono text-[11px]">public.sales_orders</span> only (not{" "}
                      <span className="font-mono text-[11px]">cars_display</span>).
                    </p>
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
                    {(sale?.reservation_date ?? car.reservation_date) && (
                      <p>
                        <span className="font-medium">Reservation:</span>{" "}
                        {new Date(
                          (sale?.reservation_date ?? car.reservation_date) as string
                        ).toLocaleDateString()}
                      </p>
                    )}
                    {(sale?.delivery_date ?? car.delivery_date) && (
                      <p>
                        <span className="font-medium">Delivery:</span>{" "}
                        {new Date((sale?.delivery_date ?? car.delivery_date) as string).toLocaleDateString()}
                      </p>
                    )}
                    {(sale?.date_bought ?? sale?.sale_date ?? car.date_bought) && (
                      <p>
                        <span className="font-medium">Date Bought:</span>{" "}
                        {new Date(
                          (sale?.date_bought ??
                            sale?.sale_date ??
                            car.date_bought) as string
                        ).toLocaleDateString()}
                      </p>
                    )}
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
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="status-dialog-reservation-new">Reservation date</Label>
                      <Input
                        id="status-dialog-reservation-new"
                        type="date"
                        value={reservationDateStr}
                        onChange={(e) => setReservationDateStr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status-dialog-delivery-new">Delivery date</Label>
                      <Input
                        id="status-dialog-delivery-new"
                        type="date"
                        value={deliveryDateStr}
                        onChange={(e) => setDeliveryDateStr(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status-dialog-date-bought-new">Date Bought</Label>
                      <Input
                        id="status-dialog-date-bought-new"
                        type="date"
                        value={dateBought}
                        onChange={(e) => setDateBought(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Writes <span className="font-mono text-[11px]">public.sales_orders</span> only.
                  </p>
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
                        <SelectItem value="inventory">Inventory</SelectItem>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                        <SelectItem value="sold">Sold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {showPlateField ? (
                    <div className="space-y-2">
                      <Label>Number plate</Label>
                      <Input
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="Car plate number"
                      />
                    </div>
                  ) : null}
                  {newStatus === "sold" && (
                    <div className="space-y-2">
                      <Label htmlFor="status-simple-delivery">Delivery date</Label>
                      <Input
                        id="status-simple-delivery"
                        type="date"
                        value={deliveryDateStr}
                        onChange={(e) => setDeliveryDateStr(e.target.value)}
                        className="max-w-xs"
                      />
                      <p className="text-muted-foreground text-xs">
                        Used to start Monza warranty when marking sold (saved to sales order or car row).
                      </p>
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
    </>
  );
}
