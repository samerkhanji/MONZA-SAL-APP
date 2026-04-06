/** Car inventory status (four values; legacy keys alias for old rows/cache). */
export const STATUS_BADGE_COLORS: Record<string, string> = {
  inventory:
    "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  available:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  reserved:
    "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200",
  sold: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  in_stock: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  showroom: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  inbound: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  delivered: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  service: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  sent_to_sub_dealer: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200",
  demo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  registered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  under_registration: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  sent_to_customs: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  company_car: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  test_drive: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

export const PDI_BADGE_COLORS: Record<string, string> = {
  pending:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export const CUSTOMS_BADGE_COLORS: Record<string, string> = {
  pending:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  in_progress:
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  cleared:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  exempt:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};
