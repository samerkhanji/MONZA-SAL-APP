export const REQUEST_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  awaiting_approval: "Awaiting Approval",
  approved: "Approved",
  rejected: "Rejected",
  needs_more_info: "Needs More Info",
};

export const REQUEST_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Medium",
  urgent: "Urgent",
};

export const REQUEST_PRIORITY_DISPLAY: Record<string, string> = {
  low: "Low",
  normal: "Medium",
  urgent: "Urgent",
};

export const REQUEST_CATEGORIES = [
  "Purchase",
  "Maintenance",
  "HR",
  "IT",
  "Other",
] as const;

export const SEND_TO_OPTIONS = [
  { value: "samer", label: "Samer" },
  { value: "kareem", label: "Kareem" },
  { value: "houssam", label: "Houssam" },
] as const;

export const SEND_TO_LABELS: Record<string, string> = {
  samer: "Samer",
  kareem: "Kareem",
  houssam: "Houssam",
};
