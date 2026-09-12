import React from "react"

import { ScrollRail } from "@/components/scroll-rail"
import { cn } from "@/lib/utils"

/**
 * `rail` swaps the plain scrolling box for the site's own scroller, which is
 * what tells a reader there are columns past the right edge. Opt-in rather than
 * the default: most tables fit, and a table that fits shows no arrow anyway, so
 * the flag marks the ones known to overflow on a phone (the profile's sessions,
 * tournaments and vehicle lists) rather than wrapping every table on the site in
 * a client component.
 */
function Table({
  className,
  rail,
  ...props
}: React.ComponentProps<"table"> & { rail?: boolean }) {
  const table = (
    <div className="grow px-(--page-padding)">
      <table
        data-slot="table"
        className={cn(
          "w-full [&_th]:text-left",
          className
        )}
        {...props}
      />
    </div>
  )
  if (rail) {
    return (
      // `stickyButtons`: a profile's vehicle list is thousands of pixels tall,
      // so an arrow centred on the rail sits screens away from whatever row the
      // reader is on.
      <ScrollRail
        stickyButtons
        dataSlot="table-container"
        containerClassName="-mx-(--page-padding) prose-table:my-[1.25em]"
        className="flex"
      >
        {table}
      </ScrollRail>
    )
  }
  return (
    <div
      data-slot="table-container"
      className="-mx-(--page-padding) flex overflow-x-auto prose-table:my-[1.25em]"
    >
      {table}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
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

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("border-b border-line", className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      // `overflow-hidden` so a heading can never spill into the next column.
      // Column widths are set for the English, and a translation is routinely
      // longer: "Rating points" is "Points de classement" in French, half again
      // as wide, and without this it was drawn straight over the numbers beside
      // it. The heading gives way, not the layout.
      className={cn(
        "overflow-hidden p-2 font-medium text-foreground first:ps-0",
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 first:ps-0", className)}
      {...props}
    />
  )
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow }
