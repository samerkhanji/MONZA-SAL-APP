import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toPublicApiError } from "@/lib/server/api-error";
import { isUuid } from "@/lib/validation/uuid";

/**
 * GDPR-style data export for a single customer.
 *
 * Returns every record we hold that ties to this customer ID, as a single
 * JSON document the owner can hand to the customer or store as evidence
 * of a fulfilled "right of access" request (Art. 15 GDPR).
 *
 * Bulk export of a customer's full personal record is sensitive: gated on
 * owner role OR the `manage_team` capability, and every export is recorded
 * in system_events for accountability.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("user_role, capabilities")
      .eq("id", user.id)
      .maybeSingle();

    const isOwner = (profile as { user_role?: string } | null)?.user_role === "owner";
    const hasManageTeam = (
      (profile as { capabilities?: string[] } | null)?.capabilities ?? []
    ).includes("manage_team");
    if (!isOwner && !hasManageTeam) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    // Pull each related dataset in parallel. RLS still applies.
    const [customer, salesOrders, paymentPlans, installments, notes, interactions, appointments] =
      await Promise.all([
        sb.from("customers").select("*").eq("id", id).maybeSingle(),
        sb.from("sales_orders").select("*").eq("customer_id", id),
        sb.from("payment_plans").select("*").eq("customer_id", id),
        sb
          .from("installment_payments")
          .select("*, plan:payment_plans!inner(customer_id)")
          .eq("plan.customer_id", id),
        sb.from("customer_notes").select("*").eq("customer_id", id),
        sb.from("customer_interactions").select("*").eq("customer_id", id),
        sb.from("appointments").select("*").eq("customer_id", id),
      ]);

    if (customer.error) {
      return NextResponse.json({ error: toPublicApiError(customer.error) }, { status: 500 });
    }
    if (!customer.data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    await sb.from("system_events").insert({
      event_type: "customer.data_export",
      severity: "warning",
      message: `Customer GDPR export for ${id} by ${user.id}`,
      metadata: {
        customer_id: id,
        actor_user_id: user.id,
      },
    });

    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        exported_by: user.id,
        purpose: "GDPR Article 15 — Right of access. Includes all data this dealership holds about the named customer.",
      },
      customer: customer.data,
      sales_orders: salesOrders.data ?? [],
      payment_plans: paymentPlans.data ?? [],
      installment_payments: installments.data ?? [],
      customer_notes: notes.data ?? [],
      customer_interactions: interactions.data ?? [],
      appointments: appointments.data ?? [],
    };

    const filename = `customer-export-${id}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: toPublicApiError(e) }, { status: 500 });
  }
}
