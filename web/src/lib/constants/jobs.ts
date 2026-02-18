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
