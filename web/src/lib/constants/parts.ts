export const PART_STATUS_COLORS: Record<string, string> = {
  in_stock: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  low_stock: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  out_of_stock: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  discontinued:
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export const PART_STATUS_LABELS: Record<string, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
  discontinued: "Discontinued",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  adjustment: "Adjustment",
  return: "Return",
};

export const CAR_MODEL_OPTIONS = [
  "General",
  "Voyah Passion",
  "Voyah Free",
  "Voyah Dreamer",
  "MHero",
] as const;
