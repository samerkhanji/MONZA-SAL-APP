import { createClient } from "@/lib/supabase";

export interface SendNotificationParams {
  userId: string;
  title: string;
  message: string;
  link?: string;
  tag?: string;
  metadata?: Record<string, unknown>;
}

/** Sends both in-app notification and push. Use for all notification triggers. */
export async function sendNotification(
  params: SendNotificationParams
): Promise<void> {
  const supabase = createClient();
  await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    is_read: false,
    metadata: params.metadata ?? null,
  });

  if (typeof window !== "undefined") {
    try {
      await fetch("/api/send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: params.userId,
          title: params.title,
          message: params.message,
          link: params.link,
          tag: params.tag,
        }),
      });
    } catch {
      // Push send is best-effort
    }
  }
}

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  return sendNotification(params);
}

export async function createNotificationsForUsers(
  userIds: string[],
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = createClient();
  const rows = userIds.map((user_id) => ({
    user_id,
    title,
    message,
    link: link ?? null,
    is_read: false,
    metadata: metadata ?? null,
  }));
  if (rows.length > 0) {
    await supabase.from("notifications").insert(rows);
  }

  if (typeof window !== "undefined") {
    // Fire push requests concurrently — a slow recipient must not block the rest.
    await Promise.allSettled(
      userIds.map((userId) =>
        fetch("/api/send-push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            title,
            message,
            link,
          }),
        })
      )
    );
    // Push send is best-effort; allSettled swallows individual failures.
  }
}
