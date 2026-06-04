"use client"

import * as React from "react"
import { CircleHelp } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * A small "?"-in-a-circle hint icon for non-obvious form fields.
 *
 * Place it next to a field's label. On hover (desktop) or tap/focus
 * (mobile + keyboard) it shows a one-sentence, plain-English explanation
 * of what the field is for.
 */
export interface FieldHintProps {
  /** Short, plain-English explanation of the field (one sentence). */
  text: string
  /** Optional extra classes for the trigger button. */
  className?: string
}

function FieldHint({ text, className }: FieldHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={text}
          // Don't let the hint icon submit the form or steal label clicks.
          onClick={(e) => e.preventDefault()}
          // Keep the icon out of the tab order so a dialog's initial
          // autofocus lands on the first real field instead of this trigger —
          // otherwise the tooltip opens unprompted on open. The hint text
          // stays available on hover and via aria-label.
          tabIndex={-1}
          className={cn(
            "text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className
          )}
        >
          <CircleHelp className="size-3.5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}

export { FieldHint }
