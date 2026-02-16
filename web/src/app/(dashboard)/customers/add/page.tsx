"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import type { LeadStatus, LeadSource } from "@/types/database";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LANGUAGE_LABELS,
} from "@/lib/constants/customers";
import { Button } from "@/components/ui/button";
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

export default function AddCustomerPage() {
  const router = useRouter();
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
  const [company, setCompany] = useState("");
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
        company: company.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      toast.error(`Failed to add customer: ${error.message}`);
      return;
    }

    toast.success("Customer added successfully");
    router.push(`/customers/${data.id}`);
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customers">← Customers</Link>
        </Button>
        <h1 className="text-2xl font-semibold">Add Customer</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Basic contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phonePrimary">Phone *</Label>
                <Input
                  id="phonePrimary"
                  type="tel"
                  value={phonePrimary}
                  onChange={(e) => setPhonePrimary(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneSecondary">Phone 2</Label>
                <Input
                  id="phoneSecondary"
                  type="tel"
                  value={phoneSecondary}
                  onChange={(e) => setPhoneSecondary(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredLanguage">Preferred Language</Label>
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

        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
            <CardDescription>Lead status and source</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leadStatus">Lead Status</Label>
                <Select
                  value={leadStatus}
                  onValueChange={(v) => setLeadStatus(v as LeadStatus)}
                >
                  <SelectTrigger id="leadStatus">
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
                <Label htmlFor="leadSource">Lead Source</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger id="leadSource">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
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
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Optional notes about this customer</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes..."
            />
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Customer"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/customers">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
