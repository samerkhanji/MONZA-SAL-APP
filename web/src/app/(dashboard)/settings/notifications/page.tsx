"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/lib/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, X } from "lucide-react";
import { formatError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";

type Category =
  | "mention"
  | "assignment"
  | "approval"
  | "reply"
  | "status_change"
  | "alert"
  | "customer"
  | "critical";

interface Prefs {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_categories: string[];
  muted_entity_keys: string[];
  desktop_push: boolean;
  sound_on_critical: boolean;
}

const CATEGORY_LABELS: Record<Category, string> = {
  mention: "Mentions",
  assignment: "Assignments",
  approval: "Approvals",
  reply: "Replies & messages",
  status_change: "Status changes",
  alert: "Alerts",
  customer: "Customer activity",
  critical: "Critical (always real-time)",
};

const CATEGORIES: Category[] = [
  "mention",
  "assignment",
  "approval",
  "reply",
  "status_change",
  "alert",
  "customer",
  "critical",
];

export default function NotificationPreferencesPage() {
  const { profile } = useUser();
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [muteInput, setMuteInput] = useState("");

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();
    if (error) {
      toast.error(formatError(error));
      setLoading(false);
      return;
    }
    if (!data) {
      // Insert a default row if it somehow doesn't exist
      const { data: ins, error: insErr } = await supabase
        .from("notification_preferences")
        .insert({ user_id: profile.id })
        .select("*")
        .single();
      if (insErr) {
        toast.error(formatError(insErr));
        setLoading(false);
        return;
      }
      setPrefs(ins as Prefs);
    } else {
      setPrefs(data as Prefs);
    }
    setLoading(false);
  }, [profile?.id, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(partial: Partial<Prefs>) {
    if (!prefs) return;
    const next = { ...prefs, ...partial };
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase
      .from("notification_preferences")
      .update({
        in_app_enabled: next.in_app_enabled,
        email_enabled: next.email_enabled,
        whatsapp_enabled: next.whatsapp_enabled,
        quiet_hours_start: next.quiet_hours_start,
        quiet_hours_end: next.quiet_hours_end,
        digest_categories: next.digest_categories,
        muted_entity_keys: next.muted_entity_keys,
        desktop_push: next.desktop_push,
        sound_on_critical: next.sound_on_critical,
      })
      .eq("user_id", next.user_id);
    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${formatError(error)}`);
      void load();
    }
  }

  function toggleDigestCategory(cat: Category) {
    if (!prefs) return;
    const has = prefs.digest_categories.includes(cat);
    const next = has
      ? prefs.digest_categories.filter((c) => c !== cat)
      : [...prefs.digest_categories, cat];
    void save({ digest_categories: next });
  }

  function addMute() {
    if (!prefs) return;
    const key = muteInput.trim();
    if (!key) return;
    if (prefs.muted_entity_keys.includes(key)) {
      toast.info("Already muted");
      return;
    }
    void save({ muted_entity_keys: [...prefs.muted_entity_keys, key] });
    setMuteInput("");
  }

  function removeMute(key: string) {
    if (!prefs) return;
    void save({
      muted_entity_keys: prefs.muted_entity_keys.filter((k) => k !== key),
    });
  }

  if (loading || !prefs) {
    return (
      <div className="container space-y-4 py-6">
        <h1 className="text-2xl font-semibold">Notification preferences</h1>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container space-y-6 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notification preferences</h1>
          <p className="text-muted-foreground text-sm">
            How you get notified. In-app + toast is always on. Email and
            WhatsApp channels will activate when wired up.
          </p>
        </div>
        {saving && (
          <span className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-3 animate-spin" /> Saving…
          </span>
        )}
      </div>

      <Card data-tour-id="settings-notifications-channels-panel">
        <CardHeader>
          <CardTitle className="text-base">Delivery channels</CardTitle>
          <CardDescription>
            Email + WhatsApp are off until those integrations are wired. Your
            choices are recorded and will activate automatically when they come
            online.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ChannelRow
            label="In-app + toast pop-ups"
            description="Always on. Bell badge updates instantly."
            checked={true}
            disabled
            onChange={() => {}}
          />
          <ChannelRow
            label="Email"
            description="Delivered to your profile email when not snoozed."
            checked={prefs.email_enabled}
            onChange={(v) => void save({ email_enabled: v })}
          />
          <ChannelRow
            label="WhatsApp"
            description="Reserved for urgent + critical events only."
            checked={prefs.whatsapp_enabled}
            onChange={(v) => void save({ whatsapp_enabled: v })}
          />
          <ChannelRow
            label="Desktop push"
            description="OS-level notifications when this tab is in the background."
            checked={prefs.desktop_push}
            onChange={(v) => void save({ desktop_push: v })}
          />
          <ChannelRow
            label="Sound on critical"
            description="Play a short tone when a critical event arrives."
            checked={prefs.sound_on_critical}
            onChange={(v) => void save({ sound_on_critical: v })}
          />
        </CardContent>
      </Card>

      <Card data-tour-id="settings-notifications-quiet-hours-panel">
        <CardHeader>
          <CardTitle className="text-base">Quiet hours</CardTitle>
          <CardDescription>
            Email + WhatsApp pause during these hours. In-app notifications
            still appear, just without the sound. Critical events always come
            through.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="qhs">Start</Label>
            <Input
              id="qhs"
              type="time"
              value={prefs.quiet_hours_start ?? ""}
              onChange={(e) =>
                void save({ quiet_hours_start: e.target.value || null })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qhe">End</Label>
            <Input
              id="qhe"
              type="time"
              value={prefs.quiet_hours_end ?? ""}
              onChange={(e) =>
                void save({ quiet_hours_end: e.target.value || null })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card data-tour-id="settings-notifications-digest-panel">
        <CardHeader>
          <CardTitle className="text-base">Daily digest</CardTitle>
          <CardDescription>
            Categories you pick here are bundled into one daily email at 8am
            instead of firing in real time. (Critical can&apos;t be bundled.)
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {CATEGORIES.filter((c) => c !== "critical").map((cat) => (
            <label
              key={cat}
              className={cn(
                "hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm",
                prefs.digest_categories.includes(cat) && "border-primary"
              )}
            >
              <Checkbox
                checked={prefs.digest_categories.includes(cat)}
                onCheckedChange={() => toggleDigestCategory(cat)}
              />
              <span>{CATEGORY_LABELS[cat]}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card data-tour-id="settings-notifications-mutes-panel">
        <CardHeader>
          <CardTitle className="text-base">Muted entities</CardTitle>
          <CardDescription>
            Specific records you no longer want notifications for. Format:{" "}
            <span className="font-mono text-xs">entity_type:uuid</span> (e.g.{" "}
            <span className="font-mono text-xs">garage_job:abcd-…</span>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              data-tour-id="settings-notifications-mute-input"
              placeholder="entity_type:uuid"
              value={muteInput}
              onChange={(e) => setMuteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMute();
                }
              }}
            />
            <Button
              data-tour-id="settings-notifications-mute-button"
              type="button"
              onClick={addMute}
              disabled={!muteInput.trim()}
            >
              Mute
            </Button>
          </div>
          {prefs.muted_entity_keys.length === 0 ? (
            <p className="text-muted-foreground text-sm">No mutes.</p>
          ) : (
            <ul className="space-y-1">
              {prefs.muted_entity_keys.map((k) => (
                <li
                  key={k}
                  className="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs">{k}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeMute(k)}
                    aria-label="Unmute"
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChannelRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "border-border flex cursor-pointer items-start gap-3 rounded-md border p-3",
        disabled && "cursor-default opacity-80"
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-1"
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </label>
  );
}
