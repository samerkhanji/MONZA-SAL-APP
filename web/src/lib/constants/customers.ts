import type { LeadStatus, LeadSource } from "@/types/database";

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new_lead: "New Lead",
  contacted: "Contacted",
  interested: "Interested",
  test_drive: "Test Drive",
  negotiation: "Negotiation",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  website: "Website",
  referral: "Referral",
  event: "Event",
  other: "Other",
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new_lead: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  contacted: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  interested: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  test_drive: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  converted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  fr: "French",
};

export const NOTE_TYPE_LABELS: Record<string, string> = {
  general: "General",
  call: "Call",
  whatsapp: "WhatsApp",
  visit: "Visit",
  follow_up: "Follow-up",
  complaint: "Complaint",
  other: "Other",
};

export const NOTE_TYPE_ICONS: Record<string, string> = {
  general: "📝",
  call: "📞",
  whatsapp: "💬",
  visit: "🏢",
  follow_up: "🔔",
  complaint: "⚠️",
  other: "📌",
};
