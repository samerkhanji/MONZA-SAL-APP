"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({
  className,
  containerClassName,
  stickyFirstColumn = false,
  ...props
}: React.ComponentProps<"table"> & {
  containerClassName?: string
  /**
   * Freeze the first column so it stays visible while scrolling sideways.
   * The frozen cells get a solid surface background (so scrolled content can't
   * bleed through) and a right divider. Use on wide tables whose first column
   * is the row's identifier.
   */
  stickyFirstColumn?: boolean
}) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        // A bounded, scrollable viewport is what makes the sticky header work:
        // the header sticks to the TOP of THIS box, so the box must be the
        // thing that scrolls (not the page). max-height only kicks in for long
        // tables; short ones never show a scrollbar.
        "relative w-full max-h-[70vh] overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]",
        containerClassName
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-sm",
          stickyFirstColumn &&
            "[&_tr>*:first-child]:sticky [&_tr>*:first-child]:left-0 [&_tr>*:first-child]:border-r [&_tr>*:first-child]:border-border [&_thead_tr>*:first-child]:z-30 [&_tbody_tr>*:first-child]:z-10 [&_tbody_tr>*:first-child]:bg-card [&_tfoot_tr>*:first-child]:z-10 [&_tfoot_tr>*:first-child]:bg-card",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b [&_tr]:bg-[var(--table-header)] [&_th]:font-semibold [&_th]:text-[var(--table-header-text)]", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t border-border font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // Zebra striping. The dark: overrides are required — without them the
        // hardcoded light backgrounds (bg-gray-50 / bg-white) render under the
        // light `text-foreground` in dark mode, making every cell invisible.
        "border-b border-border transition-colors odd:bg-gray-50 even:bg-white dark:odd:bg-muted/30 dark:even:bg-transparent data-[state=selected]:bg-accent",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // `sticky top-0` + a solid header background keeps the column titles
        // pinned while the body scrolls. z-20 sits above body cells; the frozen
        // first column bumps its own corner to z-30 (see Table).
        "sticky top-0 z-20 bg-[var(--table-header)] text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
