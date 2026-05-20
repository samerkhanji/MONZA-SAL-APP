import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCarsDisplayWith } from "@/lib/data/cars";
import { CarsInventoryClient } from "./CarsInventoryClient";

/**
 * Inventory page.
 *
 * The initial car list is fetched on the server, on every request
 * (`force-dynamic` — no caching), so the page arrives with the inventory
 * already in the HTML instead of an empty shell that fetches on the
 * client. This is still 100% live data: the query runs per request with
 * the caller's session, and the client refreshes after every mutation.
 */
export const dynamic = "force-dynamic";

export default async function CarsPage() {
  const supabase = await createClient();
  const { data } = await getCarsDisplayWith(supabase);

  return (
    <Suspense>
      <CarsInventoryClient initialCars={data} />
    </Suspense>
  );
}
