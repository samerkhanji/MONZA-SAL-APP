/**
 * One-time fix: set imported clients (who were incorrectly set as new_lead)
 * to lead_status "converted" (bought customers).
 *
 * Usage: node --env-file=.env.local scripts/fix-imported-clients-status.js [--since=YYYY-MM-DD]
 * Default since: 2025-02-01 (customize if your import was earlier)
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Load .env.local
const envPaths = [
  path.join(__dirname, "../.env.local"),
  path.join(process.cwd(), ".env.local"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        let val = trimmed.slice(eq + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      });
    break;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sinceArg = process.argv.find((a) => a.startsWith("--since="));
const since = sinceArg ? sinceArg.split("=")[1] : "2025-02-01";

const supabase = createClient(url, key);

async function main() {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone_primary, lead_status, created_at")
    .eq("lead_status", "new_lead")
    .gte("created_at", `${since}T00:00:00`);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  if (!customers?.length) {
    console.log("No new_lead customers found since", since);
    return;
  }

  console.log(`Found ${customers.length} customer(s) with lead_status new_lead since ${since}:`);
  customers.forEach((c) =>
    console.log(`  ${c.first_name} ${c.last_name || ""} (${c.phone_primary})`)
  );

  const ids = customers.map((c) => c.id);
  const { error: updateError } = await supabase
    .from("customers")
    .update({ lead_status: "converted" })
    .in("id", ids);

  if (updateError) {
    console.error("Update error:", updateError.message);
    process.exit(1);
  }

  console.log(`\nUpdated ${ids.length} customer(s) to lead_status "converted" (bought customers).`);
}

main();
