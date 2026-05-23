#!/usr/bin/env node
/**
 * Bulk-reset every Supabase Auth user’s password to a unique random temporary
 * value (service role), and flag each profile so the user must change it on
 * next login.
 *
 * SAFETY:
 *   - Default is --dry-run (no updates). Use --confirm to apply.
 *   - Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment.
 *   - Each user gets a DIFFERENT random strong password — there is no shared
 *     default. The per-user passwords are written to the CSV report so the
 *     operator can distribute them (and/or via --send-email).
 *
 * Run (from repo root, Node 20.6+ for --env-file):
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --dry-run
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --confirm
 *   node --env-file=web/.env.local scripts/bulk-reset-passwords.mjs --confirm --send-email
 *
 * Env (optional):
 *   RESEND_API_KEY             required if --send-email
 *   RESEND_FROM_EMAIL          required if --send-email
 *
 * npm: npm run bulk-reset-passwords -- --dry-run
 *      npm run bulk-reset-passwords -- --confirm
 *      npm run bulk-reset-passwords -- --confirm --send-email
 *
 * Output: ./scripts/bulk-reset-passwords-report.csv (override with BULK_RESET_CSV_PATH)
 *         The CSV contains the plaintext temporary passwords — treat it as a
 *         secret and delete it once passwords have been distributed.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, randomInt } from "node:crypto";

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

/**
 * Generate a unique, strong temporary password. Uses crypto-random bytes and
 * guarantees at least one lowercase, uppercase, digit and symbol so it meets
 * any reasonable Supabase Auth password policy.
 */
function generateTempPassword() {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = lower + upper + digits + symbols;
  const length = 20;

  const pick = (set) => set[randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  const bytes = randomBytes(length - chars.length);
  for (const b of bytes) chars.push(all[b % all.length]);

  // Fisher–Yates shuffle so the guaranteed chars aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
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
  <h2>Monza App — temporary password</h2>
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
      subject: "Monza App — your temporary password",
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
  console.log("Each user receives a unique random temporary password (see CSV report).");
  if (sendEmail) console.log("Email: will notify via Resend after each successful update.");
  console.log(`CSV output: ${csvPath}\n`);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = await fetchAllUsers(admin);
  console.log(`Found ${users.length} user(s).\n`);

  const rows = [["email", "user_id", "temp_password", "status", "email_sent", "error_message"]];
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();

  for (const u of users) {
    const email = (u.email ?? "").trim();
    const id = u.id;
    if (!email) {
      rows.push([csvEscape(""), csvEscape(id), "", "skipped_no_email", "no", ""]);
      continue;
    }

    if (!actuallyRun) {
      rows.push([csvEscape(email), csvEscape(id), "", "dry_run", "no", ""]);
      console.log(`[dry-run] ${email}`);
      continue;
    }

    const tempPassword = generateTempPassword();

    const { error: updErr } = await admin.auth.admin.updateUserById(id, {
      password: tempPassword,
    });

    if (updErr) {
      rows.push([csvEscape(email), csvEscape(id), "", "error", "no", csvEscape(updErr.message)]);
      console.error(`[error] ${email}: ${updErr.message}`);
      continue;
    }

    // Force the user to set their own password on next login.
    const { error: flagErr } = await admin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", id);
    if (flagErr) {
      console.error(`[warn] ${email}: password reset but must_change_password not set: ${flagErr.message}`);
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
      csvEscape(tempPassword),
      "updated",
      emailSent,
      csvEscape(flagErr ? `must_change_password not set: ${flagErr.message}` : emailErr),
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
