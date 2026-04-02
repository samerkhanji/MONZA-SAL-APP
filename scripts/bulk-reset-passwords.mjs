#!/usr/bin/env node
/**
 * Bulk-set every Supabase Auth user’s password to a temporary value (service role).
 *
 * SAFETY:
 *   - Default is --dry-run (no updates). Use --confirm to apply.
 *   - Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
 *
 * Run (from repo root, Node 20.6+ for --env-file):
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --dry-run
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --confirm
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --confirm --send-email
 *
 * Env (optional):
 *   BULK_RESET_TEMP_PASSWORD   default: Temp123! (must meet Supabase Auth password policy)
 *   RESEND_API_KEY             required if --send-email
 *   RESEND_FROM_EMAIL          required if --send-email
 *
 * npm: npm run bulk-reset-passwords -- --dry-run
 *      npm run bulk-reset-passwords -- --confirm
 *      npm run bulk-reset-passwords -- --confirm --send-email
 *
 * Output: ./scripts/bulk-reset-passwords-report.csv (override with BULK_RESET_CSV_PATH)
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const RESEND_URL = "https://api.resend.com/emails";

function parseArgs(argv) {
  const confirm = argv.includes("--confirm");
  const dryRunExplicit = argv.includes("--dry-run");
  const sendEmail = argv.includes("--send-email");
  // Default: dry-run. Apply only with --confirm. --dry-run + --confirm → still dry-run (safety).
  const actuallyRun = confirm && !dryRunExplicit;
  return { actuallyRun, sendEmail };
}

function csvEscape(s) {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchAllUsers(admin) {
  const perPage = 1000;
  let page = 1;
  const all = [];
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    const users = data?.users ?? [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
    if (page > 500) throw new Error("Aborting: more than 500k users — adjust script if needed.");
  }
  return all;
}

async function sendResendEmail({ to, tempPassword, from, apiKey }) {
  const html = `<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;">
  <h2>Monza CRM — temporary password</h2>
  <p>Your account password was reset by an administrator.</p>
  <p><strong>Temporary password:</strong> <code>${escapeHtml(tempPassword)}</code></p>
  <p>Sign in and change it immediately under <strong>Settings</strong> (or use “Change password”).</p>
  <p style="color:#666;font-size:14px;">If you did not expect this, contact your administrator.</p>
</body></html>`;

  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Monza CRM — your temporary password",
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function main() {
  const { actuallyRun, sendEmail } = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const tempPassword = process.env.BULK_RESET_TEMP_PASSWORD?.trim() || "Temp123!";
  const csvPath =
    process.env.BULK_RESET_CSV_PATH?.trim() ||
    resolve(process.cwd(), "scripts", "bulk-reset-passwords-report.csv");

  if (!supabaseUrl || !serviceKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Example: node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --dry-run"
    );
    process.exit(1);
  }

  if (sendEmail) {
    const rk = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!rk || !from) {
      console.error("--send-email requires RESEND_API_KEY and RESEND_FROM_EMAIL in the environment.");
      process.exit(1);
    }
  }

  console.log(
    actuallyRun
      ? "MODE: APPLY (passwords will be changed)"
      : "MODE: DRY-RUN (no password changes; add --confirm to apply)"
  );
  console.log(`Temporary password template: ${tempPassword === "Temp123!" ? "Temp123! (default)" : "(custom)"}`);
  if (sendEmail) console.log("Email: will notify via Resend after each successful update.");
  console.log(`CSV output: ${csvPath}\n`);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = await fetchAllUsers(admin);
  console.log(`Found ${users.length} user(s).\n`);

  const rows = [["email", "user_id", "status", "email_sent", "error_message"]];
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();

  for (const u of users) {
    const email = (u.email ?? "").trim();
    const id = u.id;
    if (!email) {
      rows.push([csvEscape(""), csvEscape(id), "skipped_no_email", "no", ""]);
      continue;
    }

    if (!actuallyRun) {
      rows.push([csvEscape(email), csvEscape(id), "dry_run", "no", ""]);
      console.log(`[dry-run] ${email}`);
      continue;
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(id, {
      password: tempPassword,
    });

    if (updErr) {
      rows.push([csvEscape(email), csvEscape(id), "error", "no", csvEscape(updErr.message)]);
      console.error(`[error] ${email}: ${updErr.message}`);
      continue;
    }

    let emailSent = "no";
    let emailErr = "";
    if (sendEmail && resendKey && resendFrom) {
      try {
        await sendResendEmail({
          to: email,
          tempPassword,
          from: resendFrom,
          apiKey: resendKey,
        });
        emailSent = "yes";
        console.log(`[ok+mail] ${email}`);
      } catch (e) {
        emailErr = e instanceof Error ? e.message : String(e);
        console.error(`[ok, mail failed] ${email}: ${emailErr}`);
      }
    } else {
      console.log(`[ok] ${email}`);
    }

    rows.push([
      csvEscape(email),
      csvEscape(id),
      "updated",
      emailSent,
      csvEscape(emailErr),
    ]);
  }

  const csv = rows.map((r) => r.join(",")).join("\n") + "\n";
  writeFileSync(csvPath, csv, "utf8");
  console.log(`\nWrote ${rows.length - 1} data row(s) to ${csvPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
