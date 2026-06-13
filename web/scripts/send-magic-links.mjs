#!/usr/bin/env node
/**
 * send-magic-links.mjs — Monday launch: email every active employee a one-tap
 * magic sign-in link wrapped in a greeting.
 *
 * Reuses the same path the app's password-reset flow uses:
 *   admin.auth.admin.generateLink({ type: "magiclink" })  ->  Resend email.
 *
 * SAFETY: dry-run by default. It prints exactly who WOULD receive an email and
 * sends nothing until you pass --send. Always do a --limit / --only test first.
 *
 * ── Required env (same names as the Vercel server) ──────────────────────────
 *   NEXT_PUBLIC_SUPABASE_URL        your project URL
 *   SUPABASE_SERVICE_ROLE_KEY       service-role key (server secret)
 *   RESEND_API_KEY                  https://resend.com/api-keys
 *   RESEND_FROM_EMAIL               verified sender, e.g. "Monza App <hello@yourdomain>"
 * ── Optional env ────────────────────────────────────────────────────────────
 *   APP_URL                         where the link lands (default below). MUST be
 *                                   in Supabase → Auth → URL Configuration → Redirect URLs.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node scripts/send-magic-links.mjs                       # dry run: list recipients
 *   node scripts/send-magic-links.mjs --only you@co.com --send   # real send, one address (test yourself first!)
 *   node scripts/send-magic-links.mjs --limit 3 --send      # real send, first 3 only
 *   node scripts/send-magic-links.mjs --send                # real send, ALL active employees
 *
 * Flags: --send (actually send) · --limit N · --only a@b,c@d · --delay-ms N (default 700)
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim();
const APP_URL = (process.env.APP_URL || "https://monzasal.vercel.app").trim();
const RESEND_SEND_URL = "https://api.resend.com/emails";

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const SEND = args.includes("--send");
const LIMIT = numFlag("--limit");
const DELAY_MS = numFlag("--delay-ms") ?? 700;
const ONLY = (strFlag("--only") || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function numFlag(name) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  const n = Number(args[i + 1]);
  return Number.isFinite(n) ? n : undefined;
}
function strFlag(name) {
  const i = args.indexOf(name);
  return i === -1 || i + 1 >= args.length ? undefined : args[i + 1];
}

// ── The greeting email. Edit freely — {{first_name}} is filled per person. ────
const SUBJECT = "Welcome to the new Monza App — your sign-in link";
function greetingHtml(firstName, actionLink) {
  const hi = firstName ? `Good morning, ${escapeHtml(firstName)}!` : "Good morning!";
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;background:#f6f7f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;color:#1a1a1a;">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
      <h1 style="font-size:22px;margin:0 0 12px;">${hi} 👋</h1>
      <p style="margin:0 0 16px;">Welcome to the new <strong>Monza App</strong>. We've rebuilt it to make your day faster — tap the button below to sign in instantly. No password needed.</p>
      <p style="margin:24px 0;text-align:center;">
        <a href="${escapeHtmlAttr(actionLink)}"
           style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;">
          Open Monza App
        </a>
      </p>
      <p style="margin:0 0 8px;color:#555;font-size:14px;">This link signs in only you and works on any device. It expires after a short while — if it stops working, just reply and we'll send a fresh one.</p>
      <p style="margin:24px 0 0;color:#888;font-size:13px;">See you inside,<br/>The Monza team</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeHtmlAttr(url) {
  return String(url)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;");
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────--
async function main() {
  const missing = [];
  if (!SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (SEND && !RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (SEND && !RESEND_FROM_EMAIL) missing.push("RESEND_FROM_EMAIL");
  if (missing.length) {
    console.error(`✖ Missing required env: ${missing.join(", ")}`);
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Active employees with an email. (Adjust the filter if you also want owners,
  // terminated staff, etc.)
  let { data: rows, error } = await admin
    .from("profiles")
    .select("id, full_name, email, user_role, is_active")
    .eq("is_active", true)
    .not("email", "is", null)
    .order("full_name");
  if (error) {
    console.error("✖ Could not read profiles:", error.message);
    process.exit(1);
  }

  let recipients = (rows || []).filter((r) => r.email && r.email.includes("@"));
  if (ONLY.length) recipients = recipients.filter((r) => ONLY.includes(r.email.toLowerCase()));
  if (LIMIT != null) recipients = recipients.slice(0, LIMIT);

  console.log(`\nMode: ${SEND ? "🔴 SEND (real emails)" : "🟢 DRY RUN (nothing sent)"}`);
  console.log(`Redirect (APP_URL): ${APP_URL}`);
  console.log(`Recipients: ${recipients.length}${ONLY.length ? " (--only filter)" : ""}${LIMIT != null ? ` (--limit ${LIMIT})` : ""}\n`);
  recipients.forEach((r, i) =>
    console.log(`  ${String(i + 1).padStart(3)}. ${r.email}  —  ${r.full_name || "(no name)"} [${r.user_role || "?"}]`)
  );

  if (!SEND) {
    console.log(`\n🟢 Dry run complete. Re-run with --send to actually email these ${recipients.length} people.`);
    console.log(`   Tip: test on yourself first →  --only you@example.com --send\n`);
    return;
  }

  console.log(`\nSending in 3s… (Ctrl-C to abort)`);
  await sleep(3000);

  let sent = 0;
  const failures = [];
  for (const r of recipients) {
    const email = r.email.toLowerCase();
    const firstName = (r.full_name || "").trim().split(/\s+/)[0];
    try {
      const { data, error: genErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: APP_URL },
      });
      const link = data?.properties?.action_link;
      if (genErr || !link) throw new Error(genErr?.message || "no action_link (no auth account?)");

      const res = await fetch(RESEND_SEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: RESEND_FROM_EMAIL,
          to: [email],
          subject: SUBJECT,
          html: greetingHtml(firstName, link),
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

      sent++;
      console.log(`  ✓ ${email}`);
    } catch (e) {
      failures.push({ email, reason: e.message });
      console.log(`  ✗ ${email} — ${e.message}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n── Summary ──`);
  console.log(`  Sent:   ${sent}`);
  console.log(`  Failed: ${failures.length}`);
  if (failures.length) failures.forEach((f) => console.log(`    ✗ ${f.email} — ${f.reason}`));
  console.log("");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
