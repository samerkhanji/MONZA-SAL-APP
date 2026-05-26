/**
 * Resend transactional email helper.
 *
 * This is the lowest-common-denominator wrapper around the Resend SDK so the
 * rest of the app can call `sendTransactionalEmail(...)` without needing to
 * know whether the integration is configured. The function is intentionally
 * a no-op when `RESEND_API_KEY` is missing — the same pattern as Sentry and
 * Plausible elsewhere in the codebase, so deploys without secrets configured
 * still work (preview builds, local dev, sandboxed CI).
 *
 * Not wired into any call site yet. Future PRs can adopt this for password
 * resets, welcome emails, etc. — the existing reset-password API route at
 * `web/src/app/api/auth/reset-password/route.ts` still uses a hand-rolled
 * fetch call and will be migrated separately.
 *
 * Env vars (see OBSERVABILITY_SETUP.md):
 * - RESEND_API_KEY      — required; without it this function returns early.
 * - RESEND_FROM_EMAIL   — optional; defaults to "Monza <noreply@monzasal.com>".
 */

import { Resend } from "resend";

export interface SendTransactionalEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Override the default `from` address (must be a verified Resend sender). */
  from?: string;
}

export type SendTransactionalEmailResult =
  | { skipped: true; reason: string }
  | { skipped: false; id: string | null };

const DEFAULT_FROM = "Monza <noreply@monzasal.com>";

/**
 * Lazily-constructed Resend client. We instantiate on first use so that
 * importing this module from a Server Component without `RESEND_API_KEY`
 * set doesn't throw at build time.
 */
let cachedClient: Resend | null = null;

function getClient(apiKey: string): Resend {
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }
  return cachedClient;
}

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    // Mirror the no-op behavior of the rest of the observability stack.
    // We warn (not error) so dev/preview builds stay quiet but it's still
    // discoverable in logs when someone wires this in without secrets.
    console.warn(
      "[email/resend] RESEND_API_KEY is not set — skipping outbound email.",
    );
    return { skipped: true, reason: "missing-api-key" };
  }

  const from =
    params.from?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    DEFAULT_FROM;

  const client = getClient(apiKey);
  const { data, error } = await client.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    // Throw so the caller can decide retry/log policy. Returning `skipped`
    // here would silently swallow real delivery failures.
    throw new Error(
      `[email/resend] send failed: ${error.name}: ${error.message}`,
    );
  }

  return { skipped: false, id: data?.id ?? null };
}
