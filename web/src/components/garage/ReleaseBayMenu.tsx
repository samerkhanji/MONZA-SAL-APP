"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
import { formatError } from "@/lib/error-messages";

type Action = {
  label: string;
  description: string;
  newJobStatus: string | null; // null = leave job status alone
  setBayStatus: "empty" | "cleaning" | "maintenance";
};

const ACTIONS: Action[] = [
  {
    label: "Job done",
    description: "Mark job done · bay → cleaning",
    newJobStatus: "done",
    setBayStatus: "cleaning",
  },
  {
    label: "Delivered",
    description: "Mark job delivered · bay → empty",
    newJobStatus: "delivered",
    setBayStatus: "empty",
  },
  {
    label: "Waiting parts",
    description: "Job stays open · bay → empty",
    newJobStatus: "waiting_parts",
    setBayStatus: "empty",
  },
  {
    label: "Move out (no status change)",
    description: "Free the bay; job keeps its status",
    newJobStatus: null,
    setBayStatus: "empty",
  },
  {
    label: "Bay needs cleaning",
    description: "Free the bay → cleaning",
    newJobStatus: null,
    setBayStatus: "cleaning",
  },
];

export function ReleaseBayMenu({
  bayId,
  onReleased,
}: {
  bayId: string | number;
  onReleased: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function release(action: Action) {
    setBusy(true);
    const { error } = await supabase.rpc("release_bay", {
      p_bay_id: Number(bayId),
      ...(action.newJobStatus ? { p_new_job_status: action.newJobStatus } : {}),
      ...(action.setBayStatus ? { p_set_bay_status: action.setBayStatus } : {}),
    });
    setBusy(false);
    if (error) {
      toast.error(formatError(error));
      return;
    }
    toast.success(`Released — ${action.label}`);
    onReleased();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          className="flex items-center gap-1"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
          Release
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Close out this bay</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACTIONS.map((a) => (
          <DropdownMenuItem
            key={a.label}
            onSelect={(e) => {
              e.preventDefault();
              void release(a);
            }}
            className="flex flex-col items-start"
          >
            <span className="font-medium">{a.label}</span>
            <span className="text-muted-foreground text-xs">{a.description}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
