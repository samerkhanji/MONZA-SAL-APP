import { createClient } from "@/lib/supabase";
import type { Json } from "@/lib/supabase/database.types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export type PushStatus = "enabled" | "unsupported" | "denied" | "unsubscribed";

export async function getPushStatus(): Promise<PushStatus> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "enabled";
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export type RegisterPushResult =
  | { ok: true }
  | { ok: false; reason: "vapid_missing" | "unsupported" | "permission_denied" | "subscribe_failed" | "save_failed"; message?: string };

export function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export async function registerPushSubscription(userId: string): Promise<RegisterPushResult> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
    return { ok: false, reason: "vapid_missing", message: "Push keys not configured. Restart the dev server after adding VAPID keys to .env.local." };
  }
  if (!isSecureContext()) {
    return {
      ok: false,
      reason: "subscribe_failed",
      message: "Push requires HTTPS. Your site is loading over HTTP — switch to https:// or use localhost for development.",
    };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported", message: "Push notifications are not supported in this browser." };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
    const activeReg = await navigator.serviceWorker.ready;
    let sub = await activeReg.pushManager.getSubscription();
    if (!sub) {
      const permission = await requestNotificationPermission();
      if (!permission) {
        return { ok: false, reason: "permission_denied", message: "Notification permission was denied." };
      }
      sub = await activeReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }
    await saveSubscription(userId, sub);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    console.error("Push subscribe error:", err);
    if (msg.includes("subscription") || msg.includes("push_subscriptions")) {
      return { ok: false, reason: "save_failed", message: "Could not save subscription. Ensure migration 006 has been run and the push_subscriptions table exists." };
    }
    if (
      name === "AbortError" ||
      msg.toLowerCase().includes("push service not available") ||
      msg.toLowerCase().includes("push subscription failed")
    ) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      return {
        ok: false,
        reason: "subscribe_failed",
        message: isIOS
          ? "On iPhone/iPad: Add Monza App to your Home Screen first (Share → Add to Home Screen), then open the app from the home screen icon. Push does not work in Safari tabs."
          : "Push service unavailable. Use Chrome or Edge (not incognito), ensure the site uses HTTPS, and allow notifications when prompted. On Windows: Settings → System → Notifications → ensure your browser can show notifications.",
      };
    }
    return { ok: false, reason: "subscribe_failed", message: msg || "Push subscription failed." };
  }
}

export async function unregisterPushSubscription(userId: string): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
  }

  const supabase = createClient();
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  return true;
}

async function saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const supabase = createClient();
  const json = subscription.toJSON();
  const endpoint = json.endpoint;

  // The push_subscriptions table doesn't (yet) have a unique key on
  // (user_id, endpoint), so we can't rely on upsert + onConflict. Instead,
  // detect an existing row for the same user+endpoint and skip the insert if
  // present. This avoids surfacing a misleading "could not save subscription"
  // error when the same device re-subscribes (e.g. after browser cache clear).
  if (endpoint) {
    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("subscription->>endpoint", endpoint)
      .limit(1);
    if (existing && existing.length > 0) {
      // Already registered for this device — refresh the subscription JSON in
      // case keys rotated, then we're done.
      const { error: updateError } = await supabase
        .from("push_subscriptions")
        .update({ subscription: json as unknown as Json })
        .eq("id", existing[0].id);
      if (updateError) {
        throw new Error(`push_subscriptions: ${updateError.message}`);
      }
      return;
    }
  }

  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: userId,
    subscription: json as unknown as Json,
  });
  if (error) {
    throw new Error(`push_subscriptions: ${error.message}`);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
