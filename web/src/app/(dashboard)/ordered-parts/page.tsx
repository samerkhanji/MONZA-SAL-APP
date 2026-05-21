"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { formatError } from "@/lib/error-messages";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, PackageSearch } from "lucide-react";

/**
 * Ordered Parts — a read-only consolidated view of parts on open purchase
 * orders: which parts are on order, the supplier, and the expected
 * delivery date. Sourced entirely from the Purchase Orders feature.
 */

// Purchase-order statuses that mean "ordered / on the way" — not yet fully
// received, not draft/cancelled/rejected.
const OPEN_PO_STATUSES = [
  "approved",
  "sent_to_supplier",
  "partially_received",
] as const;

const PO_STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  sent_to_supplier: "Sent to supplier",
  partially_received: "Partially received",
};

const PO_STATUS_COLOR: Record<string, string> = {
  approved: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  sent_to_supplier: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  partially_received: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
};

interface OrderedPartRow {
  id: string;
  part_name: string;
  oe_number: string | null;
  quantity: number;
  po_id: string;
  po_number: string;
  po_status: string;
  supplier_name: string;
  expected_delivery_at: string | null;
}

export default function OrderedPartsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<OrderedPartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pos, error: poErr } = await supabase
      .from("purchase_orders")
      .select("id, po_number, status, expected_delivery_at, suppliers(name)")
      .in("status", OPEN_PO_STATUSES as unknown as string[])
      .is("deleted_at", null);

    if (poErr) {
      toast.error(formatError(poErr));
      setRows([]);
      setLoading(false);
      return;
    }

    type PoRow = {
      id: string;
      po_number: string;
      status: string;
      expected_delivery_at: string | null;
      suppliers: { name: string } | { name: string }[] | null;
    };
    const poList = (pos as PoRow[]) ?? [];
    const poById = new Map(poList.map((p) => [p.id, p]));

    if (poList.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const { data: lines, error: lineErr } = await supabase
      .from("purchase_order_lines")
      .select("id, po_id, part_name, oe_number, quantity")
      .in(
        "po_id",
        poList.map((p) => p.id)
      );

    if (lineErr) {
      toast.error(formatError(lineErr));
      setRows([]);
      setLoading(false);
      return;
    }

    type LineRow = {
      id: string;
      po_id: string;
      part_name: string;
      oe_number: string | null;
      quantity: number;
    };
    const built: OrderedPartRow[] = ((lines as LineRow[]) ?? []).flatMap((ln) => {
      const po = poById.get(ln.po_id);
      if (!po) return [];
      const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
      return [
        {
          id: ln.id,
          part_name: ln.part_name,
          oe_number: ln.oe_number,
          quantity: ln.quantity,
          po_id: po.id,
          po_number: po.po_number,
          po_status: po.status,
          supplier_name: supplier?.name ?? "—",
          expected_delivery_at: po.expected_delivery_at,
        },
      ];
    });
    built.sort((a, b) => {
      const ax = a.expected_delivery_at ?? "9999";
      const bx = b.expected_delivery_at ?? "9999";
      return ax.localeCompare(bx);
    });
    setRows(built);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.part_name.toLowerCase().includes(q) ||
        (r.oe_number ?? "").toLowerCase().includes(q) ||
        r.supplier_name.toLowerCase().includes(q) ||
        r.po_number.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <PackageSearch className="size-6" />
          Ordered Parts
        </h1>
        <p className="text-muted-foreground text-sm">
          Parts on open purchase orders — what is ordered, the supplier, and
          the expected delivery date.
        </p>
      </div>

      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by part, OE number, supplier, PO number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">
              {rows.length === 0
                ? "No parts are currently on order. Create a purchase order in the Garage section to order parts."
                : "No ordered parts match the search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Part</th>
                    <th className="px-3 py-2">OE number</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Expected delivery</th>
                    <th className="px-3 py-2">Purchase order</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() =>
                        router.push(`/garage/purchase-orders/${r.po_id}`)
                      }
                    >
                      <td className="px-3 py-2 font-medium">{r.part_name}</td>
                      <td className="text-muted-foreground px-3 py-2 font-mono text-xs">
                        {r.oe_number || "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.quantity}
                      </td>
                      <td className="px-3 py-2">{r.supplier_name}</td>
                      <td className="text-muted-foreground px-3 py-2">
                        {r.expected_delivery_at
                          ? new Date(r.expected_delivery_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {r.po_number}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={PO_STATUS_COLOR[r.po_status] ?? ""}
                        >
                          {PO_STATUS_LABELS[r.po_status] ?? r.po_status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
