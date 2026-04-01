import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getSupabasePublicKey } from "@/lib/supabase/public-env";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

function configureWebPush(): { ok: true } | { ok: false; error: string } {
  if (!VAPID_PUBLIC_KEY?.trim() || !VAPID_PRIVATE_KEY?.trim()) {
    return { ok: false, error: "VAPID keys not configured" };
  }
  try {
    webpush.setVapidDetails(
      "mailto:support@monza.com",
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid VAPID keys";
    return { ok: false, error: msg };
  }
}

export async function POST(request: NextRequest) {
  const vapid = configureWebPush();
  if (!vapid.ok) {
    return NextResponse.json({ error: vapid.error }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { user_id, title, message, link, tag } = body;

    if (!user_id || !title || !message) {
      return NextResponse.json(
        { error: "Missing user_id, title, or message" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceOrPublic =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? getSupabasePublicKey();
    if (!supabaseUrl || !serviceOrPublic) {
      return NextResponse.json(
        { error: "Supabase URL or keys not configured" },
        { status: 500 }
      );
    }
    const supabase = createClient(supabaseUrl, serviceOrPublic);

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      message,
      link: link ?? "/",
      tag: tag ?? `notif-${Date.now()}`,
    });

    const results = await Promise.allSettled(
      subs.map((row) => {
        const sub = row.subscription as webpush.PushSubscription;
        return webpush.sendNotification(sub, payload);
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("Send push error:", err);
    return NextResponse.json(
      { error: "Failed to send push" },
      { status: 500 }
    );
  }
}
