/**
 * Supabase Management API (https://api.supabase.com/v1).
 * Requires SUPABASE_MANAGEMENT_ACCESS_TOKEN with infra_add_ons_read / infra_add_ons_write.
 */

const MANAGEMENT_API = "https://api.supabase.com/v1";

export type ManagementAddonVariant = {
  id: string;
  name?: string;
  price?: unknown;
  meta?: unknown;
};

export type ManagementSelectedAddon = {
  type: string;
  variant: ManagementAddonVariant;
};

export type ManagementAvailableAddon = {
  type: string;
  name?: string;
  variants: ManagementAddonVariant[];
};

export type BillingAddonsResponse = {
  selected_addons?: ManagementSelectedAddon[];
  available_addons?: ManagementAvailableAddon[];
};

export function getSupabaseProjectRef(): string | null {
  const explicit = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicit) return explicit;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9]{20})\.supabase\.co$/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function managementHeaders(): HeadersInit {
  const token = process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("SUPABASE_MANAGEMENT_ACCESS_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function managementRequest(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; text: string; json: unknown }> {
  const res = await fetch(`${MANAGEMENT_API}${path}`, {
    ...init,
    headers: {
      ...managementHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _parseError: true, text: text.slice(0, 2000) };
  }
  return { ok: res.ok, status: res.status, text, json };
}

/** Pick compute addon row (variant id typically ci_*). */
export function pickComputeSelection(
  data: BillingAddonsResponse | null
): { addonType: string; variantId: string; variantName?: string } | null {
  for (const a of data?.selected_addons ?? []) {
    const id = a?.variant?.id;
    if (typeof id !== "string") continue;
    if (a.type === "compute_instance" || /^ci_/i.test(id)) {
      return { addonType: a.type, variantId: id, variantName: a.variant?.name };
    }
  }
  return null;
}

export function pickComputeAvailableGroup(
  data: BillingAddonsResponse | null
): { addonType: string; variants: ManagementAddonVariant[] } | null {
  for (const a of data?.available_addons ?? []) {
    if (a.type === "compute_instance") {
      return { addonType: a.type, variants: a.variants ?? [] };
    }
  }
  for (const a of data?.available_addons ?? []) {
    const vars = a?.variants ?? [];
    if (vars.some((v) => typeof v.id === "string" && /^ci_/i.test(v.id))) {
      return { addonType: a.type, variants: vars };
    }
  }
  return null;
}

export function managementErrorMessage(status: number, json: unknown, text: string): string {
  if (json && typeof json === "object" && json !== null) {
    const o = json as Record<string, unknown>;
    const msg = o.message ?? o.error ?? o.msg;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
    if (typeof o.error === "object" && o.error !== null) {
      const e = o.error as Record<string, unknown>;
      if (typeof e.message === "string") return e.message;
    }
  }
  if (text.trim()) return text.trim().slice(0, 500);
  return `HTTP ${status}`;
}

export async function fetchBillingAddons(
  projectRef: string
): Promise<{ ok: true; data: BillingAddonsResponse } | { ok: false; status: number; message: string }> {
  const r = await managementRequest(`/projects/${projectRef}/billing/addons`, { method: "GET" });
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      message: managementErrorMessage(r.status, r.json, r.text),
    };
  }
  return { ok: true, data: (r.json ?? {}) as BillingAddonsResponse };
}

/**
 * Apply compute addon variant. Tries a few JSON shapes supported by the Management API.
 */
export async function patchBillingAddon(
  projectRef: string,
  addonType: string,
  variantId: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const bodies: unknown[] = [
    { addon_type: addonType, addon_variant: { id: variantId } },
    { addon_type: addonType, addon_variant: variantId },
  ];

  let lastStatus = 500;
  let lastMessage = "Unknown error";

  for (const body of bodies) {
    const r = await managementRequest(`/projects/${projectRef}/billing/addons`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (r.ok) return { ok: true };
    lastStatus = r.status;
    lastMessage = managementErrorMessage(r.status, r.json, r.text);
    if (r.status !== 400 && r.status !== 422) {
      return { ok: false, status: r.status, message: lastMessage };
    }
  }

  return { ok: false, status: lastStatus, message: lastMessage };
}

export function isRetryableComputeResizeError(status: number, message: string): boolean {
  const m = message.toLowerCase();
  if (status === 429) return true;
  if (status >= 500) return true;
  if (m.includes("compute resize failed")) return true;
  if (m.includes("resize failed")) return true;
  if (m.includes("capacity")) return true;
  if (m.includes("temporarily unavailable")) return true;
  return false;
}
