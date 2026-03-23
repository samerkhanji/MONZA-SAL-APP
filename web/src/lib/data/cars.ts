import type { CarDisplay } from "@/types/database";
import { createClient } from "@/lib/supabase";

type CarsDisplayResult = {
  data: CarDisplay[];
  error: unknown;
  aborted: boolean;
};

/**
 * Read-only list from the cars_display view. Do not use for mutating reservation/delivery dates;
 * those belong on public.sales_orders (see vehicle detail page).
 */
export async function getCarsDisplay(): Promise<CarsDisplayResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("cars_display")
    .select("*")
    .order("created_at", { ascending: false });

  const aborted =
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    ((error as { name?: string }).name === "AbortError" ||
      (typeof (error as { message?: unknown }).message === "string" &&
        String((error as { message?: unknown }).message)
          .toLowerCase()
          .includes("aborted")));

  return {
    data: (data as CarDisplay[]) ?? [],
    error: error ?? null,
    aborted,
  };
}

