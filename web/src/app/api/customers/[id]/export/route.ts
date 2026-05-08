import { NextResponse } from "next/server";
import { requireCrud } from "@/lib/server/require-crud";
import { isUuid } from "@/lib/validation/uuid";

/**
 * GDPR-style data export for a single customer.
 *
 * Returns every record we hold that ties to this customer ID, as a single
 * JSON document the owner can hand to the customer or store as evidence
 * of a fulfilled "right of access" request (Art. 15 GDPR).
 *
 * Owner-only via the requireCrud("customers", "delete") gate (same gate
 * already used for the destructive customer routes — keeps the most
 * sensitive data behind a single permission).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireCrud("customers", "delete");
    if (!gate.ok) return gate.response;

    const { id } = await ctx.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const sb = gate.supabase;

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
      return NextResponse.json({ error: customer.error.message }, { status: 500 });
    }
    if (!customer.data) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const payload = {
      meta: {
        exported_at: new Date().toISOString(),
        exported_by: gate.userId,
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
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
