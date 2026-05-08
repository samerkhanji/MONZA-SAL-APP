"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { CustomerDisplay, LeadStatus, LeadSource } from "@/types/database";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LANGUAGE_LABELS,
} from "@/lib/constants/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizePhone } from "@/lib/phone";
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
import { formatError } from "@/lib/error-messages";

interface EditCustomerDialogProps {
  customer: CustomerDisplay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: EditCustomerDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phonePrimary, setPhonePrimary] = useState("");
  const [phoneSecondary, setPhoneSecondary] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [leadStatus, setLeadStatus] = useState<LeadStatus>("new_lead");
  const [leadSource, setLeadSource] = useState<string>("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (customer && open) {
      setFirstName(customer.first_name ?? "");
      setLastName(customer.last_name ?? "");
      setPhonePrimary(customer.phone_primary ?? "");
      setPhoneSecondary(customer.phone_secondary ?? "");
      setEmail(customer.email ?? "");
      setDateOfBirth(customer.date_of_birth ? customer.date_of_birth.slice(0, 10) : "");
      setPreferredLanguage(customer.preferred_language ?? "en");
      setLeadStatus((customer.lead_status as LeadStatus) ?? "new_lead");
      setLeadSource(customer.lead_source ?? "");
      setAddress(customer.address ?? "");
      setNotes(customer.notes ?? "");
    }
  }, [customer, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customer) return;

    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!phonePrimary.trim()) {
      toast.error("Phone is required");
      return;
    }

    // If the phone changed, pre-check for an existing customer with the same
    // normalized phone (matches the unique partial index — closes audit H9).
    const newNormalized = normalizePhone(phonePrimary);
    const oldNormalized = normalizePhone(customer?.phone_primary ?? "");
    if (newNormalized && newNormalized !== oldNormalized) {
      const { data: hits } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone_primary")
        .is("deleted_at", null)
        .neq("id", customer.id)
        .ilike("phone_primary", `%${newNormalized.replace("+", "")}%`)
        .limit(20);
      const collision = (hits ?? []).find(
        (c: { phone_primary?: string | null }) =>
          normalizePhone((c as { phone_primary?: string }).phone_primary) ===
          newNormalized
      ) as
        | { id: string; first_name: string; last_name: string | null }
        | undefined;
      if (collision) {
        const fullName = `${collision.first_name}${collision.last_name ? ` ${collision.last_name}` : ""}`;
        toast.error(
          `That phone number already belongs to ${fullName}. Open their record instead.`
        );
        return;
      }
    }

    setSubmitting(true);

    const { error } = await supabase
      .from("customers")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone_primary: phonePrimary.trim(),
        phone_secondary: phoneSecondary.trim() || null,
        email: email.trim() || null,
        date_of_birth: dateOfBirth || null,
        preferred_language: preferredLanguage || "en",
        lead_status: leadStatus,
        lead_source: (leadSource as LeadSource) || null,
        company: customer.company ?? null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", customer.id);

    setSubmitting(false);

    if (error) {
      toast.error(`Failed to update: ${formatError(error)}`);
      return;
    }

    toast.success("Customer updated successfully");
    onSuccess();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update customer information
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First Name *</Label>
              <Input
                id="edit-first-name"
                name="edit-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-last-name"
                name="edit-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone *</Label>
              <Input
                id="edit-phone"
                name="edit-phone"
                type="tel"
                inputMode="tel"
                placeholder="+961 1 234 5678"
                value={phonePrimary}
                onChange={(e) => setPhonePrimary(e.target.value)}
                required
              />
              {phonePrimary.trim() &&
                normalizePhone(phonePrimary) !==
                  normalizePhone(customer?.phone_primary ?? "") && (
                  <p className="text-muted-foreground text-xs">
                    Saved as{" "}
                    <span className="font-mono">
                      {normalizePhone(phonePrimary)}
                    </span>{" "}
                    (spaces and dashes are stripped before comparing for duplicates).
                  </p>
                )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone2">Phone 2</Label>
              <Input
                id="edit-phone2"
                name="edit-phone2"
                type="tel"
                value={phoneSecondary}
                onChange={(e) => setPhoneSecondary(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              name="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <Input
                id="edit-dob"
                name="edit-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lang">Preferred Language</Label>
              <Select
                value={preferredLanguage}
                onValueChange={setPreferredLanguage}
              >
                <SelectTrigger id="edit-lang">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-status">Lead Status</Label>
              <Select
                value={leadStatus}
                onValueChange={(v) => setLeadStatus(v as LeadStatus)}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-source">Lead Source</Label>
              <Select
                value={leadSource || "_"}
                onValueChange={(v) => setLeadSource(v === "_" ? "" : v)}
              >
                <SelectTrigger id="edit-source">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">—</SelectItem>
                  {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-address">Address</Label>
            <Textarea
              id="edit-address"
              name="edit-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              name="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
