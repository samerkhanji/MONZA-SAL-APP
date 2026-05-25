import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// Roles that may fan out push notifications to arbitrary users.
// Everyone else can only push to themselves (e.g. a test).
const BROADCAST_ROLES = new Set([
  "owner",
  "assistant",
  "hybrid",
  "khalil_hybrid",
  "it",
  "garage_manager",
  "sales_ops",
]);

function configureWebPush(): { ok: true } | { ok: false; error: string } {
  if (!VAPID_PUBLIC_KEY?.trim() || !VAPID_PRIVATE_KEY?.trim()) {
    return { ok: false, error: "VAPID keys not configured" };
  }
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT?.trim() || "mailto:support@monzasal.com",
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

  // Require authenticated session.
  const serverClient = await createServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await serverClient
    .from("profiles")
    .select("user_role")
    .eq("id", user.id)
    .single();

  const callerRole = (callerProfile?.user_role as string | undefined) ?? null;

  try {
    const body = await request.json();
    const { user_id, title, message, link, tag } = body as {
      user_id?: string;
      title?: string;
      message?: string;
      link?: string;
      tag?: string;
    };

    if (!user_id || typeof user_id !== "string" || !title || !message) {
      return NextResponse.json(
        { error: "Missing user_id, title, or message" },
        { status: 400 }
      );
    }

    // Enforce target authorization: self-push always allowed; fan-out gated by role.
    if (user_id !== user.id) {
      if (!callerRole || !BROADCAST_ROLES.has(callerRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Only proceed with service role (we already authorized the caller).
    const supabase = tryCreateAdminClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase service credentials not configured" },
        { status: 500 }
      );
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, subscription")
      .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Cap fields we forward to the browser.
    const safeTitle = String(title).slice(0, 200);
    const safeMessage = String(message).slice(0, 1000);
    const safeLink = typeof link === "string" && link.startsWith("/") ? link : "/";

    const payload = JSON.stringify({
      title: safeTitle,
      message: safeMessage,
      link: safeLink,
      tag: typeof tag === "string" ? tag.slice(0, 80) : `notif-${Date.now()}`,
    });

    const results = await Promise.allSettled(
      subs.map((row) => {
        const sub = row.subscription as webpush.PushSubscription;
        return webpush.sendNotification(sub, payload);
      })
    );

    // Prune subscriptions whose endpoint the push service has retired.
    // Without this, push_subscriptions grows monotonically and every send
    // to a dead endpoint re-fails forever, wasting Vercel/web-push budget.
    const deadIds: string[] = [];
    results.forEach((r, i) => {
      if (r.status !== "rejected") return;
      const reason = r.reason as { statusCode?: number } | undefined;
      const code = reason?.statusCode;
      if (code === 404 || code === 410) {
        const id = (subs[i] as { id?: string }).id;
        if (id) deadIds.push(id);
      }
    });
    if (deadIds.length > 0) {
      const { error: pruneErr } = await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", deadIds);
      if (pruneErr) {
        console.error("Failed to prune dead push subscriptions:", pruneErr);
      }
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ sent, pruned: deadIds.length });
  } catch (err) {
    console.error("Send push error:", err);
    return NextResponse.json(
      { error: "Failed to send push" },
      { status: 500 }
    );
  }
}
