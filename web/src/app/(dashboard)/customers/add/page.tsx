"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { normalizePhone } from "@/lib/phone";
import type { LeadStatus, LeadSource } from "@/types/database";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LANGUAGE_LABELS,
} from "@/lib/constants/customers";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatError } from "@/lib/error-messages";

export default function AddCustomerPage() {
  const router = useRouter();
  const { isOwner, hasCapability, appRole, loading: userLoading } = useUser();
  // RLS allows sales_ops and assistant to write customer rows post-126;
  // gate the UI to match so non-allowed roles get a clean message instead
  // of a 403 toast on submit.
  const canAddCustomer =
    isOwner ||
    hasCapability("sales") ||
    appRole === "sales_ops" ||
    appRole === "assistant";

  const [submitting, setSubmitting] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!firstName.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!phonePrimary.trim()) {
      toast.error("Phone is required");
      return;
    }

    const emailTrimmed = email.trim();
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);

    const supabase = createClient();

    // Pre-check for an existing active customer with the same normalized
    // phone. Catches duplicates with cleaner messaging than the DB unique
    // index (which fires only on insert and gives a less friendly error).
    const normalized = normalizePhone(phonePrimary);
    if (normalized) {
      const { data: existing } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone_primary")
        .is("deleted_at", null)
        .ilike("phone_primary", `%${normalized.replace("+", "")}%`)
        .limit(20);
      const match = (existing ?? []).find(
        (c) => normalizePhone(c.phone_primary) === normalized
      );
      if (match) {
        const fullName = `${match.first_name}${match.last_name ? ` ${match.last_name}` : ""}`;
        setSubmitting(false);
        toast.error(
          `A customer with this phone already exists: ${fullName}. Open their record instead.`
        );
        router.push(`/customers/${match.id}`);
        return;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone_primary: phonePrimary.trim(),
        phone_secondary: phoneSecondary.trim() || null,
        email: emailTrimmed || null,
        date_of_birth: dateOfBirth || null,
        preferred_language: preferredLanguage || "en",
        lead_status: leadStatus,
        lead_source: (leadSource as LeadSource) || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      // Unique-index violation = race against another tab beating us to insert.
      if (error.code === "23505") {
        toast.error(
          "A customer with this phone was just added by someone else. Please refresh."
        );
        return;
      }
      toast.error(`Failed to add customer: ${formatError(error)}`);
      return;
    }

    toast.success("Customer added successfully");
    router.push(`/customers/${data.id}`);
  }

  if (userLoading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!canAddCustomer) {
    return (
      <div className="container mx-auto max-w-2xl space-y-3 px-4 py-10 text-center sm:px-6">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="text-muted-foreground text-sm">
          Adding customers is available to owner, sales, sales ops, and the
          assistant. Ask an owner if you think this is a mistake.
        </p>
        <Button variant="outline" asChild>
          <Link href="/customers">Back to customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild data-tour-id="customers-add-back-button">
          <Link href="/customers">← Customers</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Add Customer</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" data-tour-id="customers-add-form">
        <Card data-tour-id="customers-add-personal-panel">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Basic contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-first-name">First Name *</Label>
                <Input
                  id="customer-first-name"
                  name="customer-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-tour-id="customers-add-first-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-last-name">Last Name</Label>
                <Input
                  id="customer-last-name"
                  name="customer-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-phone-primary">Phone *</Label>
                <Input
                  id="customer-phone-primary"
                  name="customer-phone-primary"
                  type="tel"
                  inputMode="tel"
                  placeholder="+961 1 234 5678"
                  value={phonePrimary}
                  onChange={(e) => setPhonePrimary(e.target.value)}
                  required
                  data-tour-id="customers-add-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone-secondary">Phone 2</Label>
                <Input
                  id="customer-phone-secondary"
                  name="customer-phone-secondary"
                  type="tel"
                  inputMode="tel"
                  placeholder="Optional"
                  value={phoneSecondary}
                  onChange={(e) => setPhoneSecondary(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                name="customer-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                data-tour-id="customers-add-email-input"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer-date-of-birth">Date of Birth</Label>
                <Input
                  id="customer-date-of-birth"
                  name="customer-date-of-birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredLanguage">
                  Preferred Language
                  <FieldHint text="The language this customer is most comfortable speaking with." />
                </Label>
                <Select
                  value={preferredLanguage}
                  onValueChange={setPreferredLanguage}
                >
                  <SelectTrigger id="preferredLanguage">
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
          </CardContent>
        </Card>

        <Card data-tour-id="customers-add-lead-panel">
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
            <CardDescription>Lead status and source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadStatus">
                  Lead Status
                  <FieldHint text="How far along this person is toward buying — from a brand-new lead to a closed sale." />
                </Label>
                <Select
                  value={leadStatus}
                  onValueChange={(v) => setLeadStatus(v as LeadStatus)}
                >
                  <SelectTrigger id="leadStatus" data-tour-id="customers-add-lead-status-select">
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
                <Label htmlFor="leadSource">
                  Lead Source
                  <FieldHint text="Where this customer first heard about you — a referral, a social media ad, a walk-in, and so on." />
                </Label>
                <Select
                  value={leadSource || "_"}
                  onValueChange={(v) => setLeadSource(v === "_" ? "" : v)}
                >
                  <SelectTrigger id="leadSource" data-tour-id="customers-add-lead-source-select">
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
              <Label htmlFor="customer-address">Address</Label>
              <Textarea
                id="customer-address"
                name="customer-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card data-tour-id="customers-add-notes-panel">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Optional notes about this customer</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="customer-notes"
              name="customer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes..."
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting} data-tour-id="customers-add-submit-button">
            {submitting ? "Adding..." : "Add Customer"}
          </Button>
          <Button type="button" variant="outline" asChild data-tour-id="customers-add-cancel-button">
            <Link href="/customers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
