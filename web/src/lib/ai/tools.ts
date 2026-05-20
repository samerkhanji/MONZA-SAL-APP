import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only data tools for the Monza Assistant.
 *
 * Every tool queries Supabase through the *caller's* authenticated client,
 * so Row-Level Security scopes every result to exactly what that user is
 * already allowed to see — the assistant cannot read anything the user
 * couldn't read themselves. All tools are strictly read-only: no inserts,
 * updates, or deletes.
 */
export const MONZA_ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_cars",
    description:
      "Search the live car inventory by VIN, brand, or model text, and/or by status. Use this for questions about specific cars or what is in stock. Returns up to 20 matching cars.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Free text matched against VIN, brand and model. Optional.",
        },
        status: {
          type: "string",
          description:
            "Optional car status filter, e.g. inventory, available, reserved, sold, delivered, service, inbound.",
        },
      },
    },
  },
  {
    name: "inventory_summary",
    description:
      "Get a count of all cars in inventory grouped by status (e.g. how many are in stock, sold, reserved). Takes no parameters.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_customers",
    description:
      "Look up customers by name or phone number. Returns up to 20 matches.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer name or phone number to search for.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_garage_jobs",
    description:
      "List garage service jobs, most recent first, optionally filtered by status. Returns up to 20 jobs.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "Optional job status filter, e.g. open, in_progress, done, delivered.",
        },
      },
    },
  },
];

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Strip characters that break the PostgREST or() filter grammar. */
function safeLike(v: string): string {
  return v.replace(/[,()*]/g, " ").trim();
}

/**
 * Executes one assistant tool. The supabase client must be the caller's
 * cookie-bound server client so RLS applies to every query.
 */
export async function runAssistantTool(
  name: string,
  input: unknown,
  supabase: SupabaseClient
): Promise<string> {
  const args = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  try {
    switch (name) {
      case "search_cars": {
        const q = safeLike(str(args.query));
        const status = str(args.status).trim();
        let query = supabase
          .from("cars_display")
          .select(
            "vin, brand, model, model_year, status, location_type, exterior_color"
          )
          .is("deleted_at", null)
          .limit(20);
        if (q) {
          query = query.or(
            `vin.ilike.%${q}%,brand.ilike.%${q}%,model.ilike.%${q}%`
          );
        }
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: data?.length ?? 0, cars: data ?? [] });
      }

      case "inventory_summary": {
        const { data, error } = await supabase
          .from("cars_display")
          .select("status")
          .is("deleted_at", null);
        if (error) return JSON.stringify({ error: error.message });
        const byStatus: Record<string, number> = {};
        for (const row of (data ?? []) as { status: string }[]) {
          byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
        }
        return JSON.stringify({
          total: data?.length ?? 0,
          by_status: byStatus,
        });
      }

      case "search_customers": {
        const q = safeLike(str(args.query));
        if (!q) {
          return JSON.stringify({
            error: "A name or phone number is required.",
          });
        }
        const like = `%${q}%`;
        const { data, error } = await supabase
          .from("customers_display")
          .select("full_name, phone_primary, phone_secondary")
          .is("deleted_at", null)
          .or(
            `full_name.ilike.${like},first_name.ilike.${like},last_name.ilike.${like},phone_primary.ilike.${like},phone_secondary.ilike.${like}`
          )
          .limit(20);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({
          count: data?.length ?? 0,
          customers: data ?? [],
        });
      }

      case "list_garage_jobs": {
        const status = str(args.status).trim();
        let query = supabase
          .from("garage_jobs")
          .select(
            "job_number, status, title, complaint, created_at, cars:car_id(vin, brand, model)"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ count: data?.length ?? 0, jobs: data ?? [] });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : "Tool execution failed.",
    });
  }
}
