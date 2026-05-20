import type { SupabaseClient } from "@supabase/supabase-js";
import type { CarDisplay } from "@/types/database";
import { createClient } from "@/lib/supabase";

export type CarsDisplayResult = {
  data: CarDisplay[];
  error: unknown;
  aborted: boolean;
  /** True when public.cars was used because cars_display failed (e.g. schema cache / missing relation). */
  usedFallback?: boolean;
};

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const e = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  return [e.message, e.details, e.hint]
    .filter((x) => typeof x === "string")
    .join(" ")
    .toLowerCase();
}

/**
 * PostgREST / cache / DDL: retry list fetch on public.cars when cars_display is not yet visible.
 */
export function shouldFallbackFromCarsDisplayError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: unknown };
  const code = (e.code ?? "").toString();
  const msg = errorText(error);
  if (code === "PGRST205" || code === "42P01") return true;
  if (msg.includes("schema cache")) return true;
  if (msg.includes("could not find") && msg.includes("cars_display")) return true;
  if (msg.includes("relation") && msg.includes("cars_display") && msg.includes("does not exist"))
    return true;
  return false;
}

/**
 * Read-only inventory list: try cars_display first, then public.cars with the same shape.
 * Do not use for mutating reservation/delivery dates; those belong on public.sales_orders.
 *
 * Accepts an explicit Supabase client so it works both in the browser
 * (getCarsDisplay) and in a Server Component with the cookie-bound server
 * client — letting the cars page render with data already in the HTML.
 */
export async function getCarsDisplayWith(
  supabase: SupabaseClient
): Promise<CarsDisplayResult> {
  const abortedFrom = (error: unknown) =>
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    ((error as { name?: string }).name === "AbortError" ||
      (typeof (error as { message?: unknown }).message === "string" &&
        String((error as { message?: unknown }).message)
          .toLowerCase()
          .includes("aborted")));

  const primary = await supabase
    .from("cars_display")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (primary.error && abortedFrom(primary.error)) {
    return {
      data: [],
      error: primary.error,
      aborted: true,
    };
  }

  if (!primary.error) {
    return {
      data: (primary.data as CarDisplay[]) ?? [],
      error: null,
      aborted: false,
    };
  }

  if (!shouldFallbackFromCarsDisplayError(primary.error)) {
    return {
      data: [],
      error: primary.error,
      aborted: false,
    };
  }

  const fallback = await supabase
    .from("cars")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (fallback.error) {
    return {
      data: [],
      error: fallback.error,
      aborted: abortedFrom(fallback.error),
      usedFallback: true,
    };
  }

  return {
    data: (fallback.data as CarDisplay[]) ?? [],
    error: null,
    aborted: false,
    usedFallback: true,
  };
}

/** Browser-side inventory list fetch. */
export async function getCarsDisplay(): Promise<CarsDisplayResult> {
  return getCarsDisplayWith(createClient());
}

