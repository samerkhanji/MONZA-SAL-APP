"use server";

import { revalidatePath } from "next/cache";

export async function refreshOwnerOverview() {
  revalidatePath("/dashboard/overview");
}
