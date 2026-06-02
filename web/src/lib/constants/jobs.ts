export const JOB_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  waiting_parts:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  waiting_parts: "Waiting Parts",
  done: "Done",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const JOB_PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export const JOB_PRIORITY_LABELS: Record<string, string> = {
  low: "🟢 Low",
  normal: "🟡 Medium",
  urgent: "🔴 Urgent",
};

// Allowed next statuses for a garage job. A job can always keep its current
// status; only the listed transitions may be applied from the UI. Terminal
// statuses (cancelled) cannot move; `delivered` is terminal in practice.
export const JOB_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["waiting_parts", "done", "cancelled"],
  waiting_parts: ["in_progress", "cancelled"],
  done: ["delivered"],
  delivered: [],
  cancelled: [],
};

/**
 * Format a job's estimated/actual hours for display.
 *
 * `actual_hours` is accumulated from raw minute-level work sessions, so it can
 * carry long floating-point tails (e.g. 0.0333333333333…). Round to at most two
 * decimals and drop trailing zeros so "3" stays "3" and 0.0333… reads "0.03".
 * Returns an em dash for null/undefined/NaN so callers can render `{fmt}h`.
 */
export function formatHours(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

export const PRIORITY_BORDERS: Record<string, string> = {
  low: "border-l-4 border-l-gray-300",
  normal: "border-l-4 border-l-blue-500",
  urgent: "border-l-4 border-l-red-500",
};

export const JOB_DOCUMENT_TYPES = [
  { value: "job_card", label: "Job Card" },
  { value: "diagnosis_report", label: "Diagnosis Report" },
  { value: "photo_before", label: "Photo Before" },
  { value: "photo_after", label: "Photo After" },
  { value: "other", label: "Other" },
] as const;
