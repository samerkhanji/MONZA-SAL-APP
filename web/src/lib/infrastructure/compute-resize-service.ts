import { type SupabaseClient } from "@supabase/supabase-js";
import { withExponentialBackoff } from "@/lib/infrastructure/exponential-backoff";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  fetchBillingAddons,
  getSupabaseProjectRef,
  isRetryableComputeResizeError,
  patchBillingAddon,
  pickComputeAvailableGroup,
  pickComputeSelection,
  type BillingAddonsResponse,
} from "@/lib/infrastructure/supabase-management";

const RESEND_SEND_URL = "https://api.resend.com/emails";

export type ComputeStatusPayload = {
  configured: boolean;
  projectRef: string | null;
  managementConfigured: boolean;
  current: { addonType: string; variantId: string; variantName?: string } | null;
  desired: { addonType: string; variantId: string | null } | null;
  inSync: boolean | null;
  availableVariants: { id: string; name?: string }[];
  recentEvents: Array<{
    id: string;
    event_type: string;
    severity: string;
    message: string | null;
    created_at: string;
  }>;
};

// Thin alias kept for local readability; the underlying factory is the
// centralized one in `lib/supabase/admin.ts`.
const createServiceClient = tryCreateAdminClient;

export async function insertSystemEvent(
  event_type: string,
  opts: {
    severity?: string;
    message?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const admin = createServiceClient();
  if (!admin) return;
  const { error } = await admin.from("system_events").insert({
    event_type,
    severity: opts.severity ?? "info",
    message: opts.message ?? null,
    metadata: opts.metadata ?? {},
  });
  if (error) {
    console.error("[system_events] insert failed:", error.message);
  }
}

async function sendOpsAlert(subject: string, html: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const to = process.env.OPS_ALERT_EMAIL?.trim() ?? process.env.COMPUTE_ALERT_EMAIL?.trim();
  if (!resendKey || !fromEmail || !to) return false;

  const res = await fetch(RESEND_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  });
  return res.ok;
}

async function maybeEmailRepeatedFailureAlert(params: {
  failureMessage: string;
  projectRef: string;
  attemptCount: number;
}): Promise<void> {
  const admin = createServiceClient();
  if (!admin) return;

  const threshold = Math.max(
    2,
    Number.parseInt(process.env.COMPUTE_RESIZE_ALERT_THRESHOLD ?? "3", 10) || 3
  );
  const windowMins = 60;
  const since = new Date(Date.now() - windowMins * 60 * 1000).toISOString();

  const { count, error } = await admin
    .from("system_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "compute_resize_failed")
    .gte("created_at", since);

  if (error || count == null || count < threshold) return;

  const dedupeSince = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { count: recentAlerts } = await admin
    .from("system_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "compute_resize_alert_email_sent")
    .gte("created_at", dedupeSince);

  if ((recentAlerts ?? 0) > 0) return;

  const sent = await sendOpsAlert(
    `[Monza App] Supabase compute resize failures (${count} in ${windowMins}m)`,
    `<p>Project ref: <code>${params.projectRef}</code></p>
     <p>Recent failure: ${escapeHtml(params.failureMessage)}</p>
     <p>Backoff attempts (last run): ${params.attemptCount}</p>
     <p>This does not fix cloud capacity limits. Retry from Settings → Database compute or Supabase Dashboard.</p>`
  );

  if (sent) {
    await admin.from("system_events").insert({
      event_type: "compute_resize_alert_email_sent",
      severity: "warning",
      message: `Alert emailed after ${count} compute_resize_failed events in ${windowMins}m`,
      metadata: { count, windowMins, threshold },
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Owner session client for RLS-backed reads; omit only in tests. */
export async function loadComputeStatusForOwner(
  userSupabase: SupabaseClient
): Promise<ComputeStatusPayload> {
  const projectRef = getSupabaseProjectRef();
  const token = process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim();
  const managementConfigured = !!token && !!projectRef;

  let addons: BillingAddonsResponse | null = null;
  if (managementConfigured && projectRef) {
    const r = await fetchBillingAddons(projectRef);
    if (r.ok) addons = r.data;
  }

  const current = addons ? pickComputeSelection(addons) : null;
  const group = addons ? pickComputeAvailableGroup(addons) : null;
  const availableVariants = (group?.variants ?? [])
    .filter((v) => typeof v.id === "string")
    .map((v) => ({ id: v.id, name: v.name }));

  let desired: { addonType: string; variantId: string | null } | null = null;
  let recentEvents: ComputeStatusPayload["recentEvents"] = [];

  const { data: row } = await userSupabase
    .from("infrastructure_compute_target")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (row) {
    desired = {
      addonType: (row as { desired_addon_type?: string }).desired_addon_type ?? "compute_instance",
      variantId: (row as { desired_variant_id?: string | null }).desired_variant_id ?? null,
    };
  }
  const { data: evs } = await userSupabase
    .from("system_events")
    .select("id, event_type, severity, message, created_at")
    .in("event_type", [
      "compute_resize_failed",
      "compute_resize_succeeded",
      "compute_resize_attempt",
      "compute_resize_alert_email_sent",
    ])
    .order("created_at", { ascending: false })
    .limit(40);
  recentEvents = (evs ?? []) as ComputeStatusPayload["recentEvents"];

  const inSync =
    current && desired?.variantId
      ? current.variantId === desired.variantId
      : current && !desired?.variantId
        ? true
        : null;

  return {
    configured: managementConfigured,
    projectRef,
    managementConfigured,
    current,
    desired,
    inSync,
    availableVariants,
    recentEvents,
  };
}

export type RetryComputeResult =
  | { ok: true; attempts: number; message: string }
  | { ok: false; attempts: number; message: string };

/**
 * PATCH billing addon with exponential backoff; logs each failure to system_events.
 */
export async function retryComputeUpgradeWithBackoff(params: {
  addonType: string;
  variantId: string;
}): Promise<RetryComputeResult> {
  const projectRef = getSupabaseProjectRef();
  if (!projectRef) {
    return { ok: false, attempts: 0, message: "SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL not configured." };
  }
  if (!process.env.SUPABASE_MANAGEMENT_ACCESS_TOKEN?.trim()) {
    return { ok: false, attempts: 0, message: "SUPABASE_MANAGEMENT_ACCESS_TOKEN not set." };
  }

  let lastFailureMessage = "";

  const result = await withExponentialBackoff<{ message: string }>(
    async (attemptIndex) => {
      await insertSystemEvent("compute_resize_attempt", {
        severity: "info",
        message: `Attempt ${attemptIndex + 1}: apply ${params.addonType} / ${params.variantId}`,
        metadata: { variantId: params.variantId, addonType: params.addonType, projectRef },
      });

      const patch = await patchBillingAddon(projectRef, params.addonType, params.variantId);
      if (patch.ok) {
        return { ok: true, value: { message: "Resize request accepted." } };
      }

      const msg = patch.message;
      lastFailureMessage = msg;
      await insertSystemEvent("compute_resize_failed", {
        severity: "error",
        message: msg,
        metadata: {
          status: patch.status,
          variantId: params.variantId,
          addonType: params.addonType,
          projectRef,
        },
      });

      const retryable = isRetryableComputeResizeError(patch.status, msg);
      return { ok: false, retryable };
    },
    {
      maxAttempts: Math.min(8, Math.max(3, Number.parseInt(process.env.COMPUTE_RESIZE_MAX_ATTEMPTS ?? "5", 10) || 5)),
      baseDelayMs: Number.parseInt(process.env.COMPUTE_RESIZE_BACKOFF_BASE_MS ?? "1000", 10) || 1000,
      maxDelayMs: Number.parseInt(process.env.COMPUTE_RESIZE_BACKOFF_MAX_MS ?? "32000", 10) || 32000,
    }
  );

  if (result.ok) {
    await insertSystemEvent("compute_resize_succeeded", {
      severity: "info",
      message: `Applied ${params.addonType} variant ${params.variantId} after ${result.attempts} attempt(s).`,
      metadata: { variantId: params.variantId, addonType: params.addonType, attempts: result.attempts },
    });
    return { ok: true, attempts: result.attempts, message: result.value.message };
  }

  await maybeEmailRepeatedFailureAlert({
    failureMessage: lastFailureMessage || "Compute resize failed after retries.",
    projectRef,
    attemptCount: result.attempts,
  });

  return {
    ok: false,
    attempts: result.attempts,
    message: lastFailureMessage || "Compute resize failed after retries.",
  };
}
