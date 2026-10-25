"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { TableHead } from "@/components/ui/table";
import { styles } from "@/lib/styles";
import { cn } from "@/lib/utils";

// The sortable column heading every vehicle table shares: the label (or a glyph
// with its name in the tooltip), the caret showing the active direction, and a
// cell whose whole width is the click target.
//
// Lifted out of the profile's vehicle table once a second table needed the same
// heading. Copying it would have been the fourth copy of this pattern on the
// site, and the two would have drifted on the thing that is easiest to get
// wrong: the padding lives on the BUTTON here, not on the cell, so a table
// putting it on the cell instead draws its headings offset from its own
// columns.

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

export type SortState = { key: string; direction: SortDirection } | null;

export function SortableHead({
  col,
  state,
  onToggle,
  align = "start",
  hideOnMobile,
  headClassName,
  tooltip,
  ratingCol,
  ratingWnCol,
  children,
}: {
  col: string;
  state: SortState;
  onToggle: (key: string) => void;
  align?: "start" | "center" | "end";
  hideOnMobile?: boolean;
  headClassName?: string;
  tooltip?: string;
  /** Tags the column with the rating metric it shows, so the site's
   * cookie-painted CSS hides it unless that metric is the one selected. */
  ratingCol?: string;
  /** The same for a column carrying a WN rating only (a vehicle's, a
   * battle's), which follows the WN fallback of the reader's pick. */
  ratingWnCol?: string;
  children: React.ReactNode;
}) {
  const active = state?.key === col;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onToggle(col)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left font-medium select-none hover:text-foreground",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        active ? "text-foreground" : "",
      )}
    >
      {/* `data-head-label` is what the tooltip measures: it shows the full
            heading only when the column really cut it. */}
      <span data-head-label className="truncate">
        {children}
      </span>
      <Icon
        weight="bold"
        className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
  return (
    <TableHead
      data-rating-col={ratingCol}
      data-rating-wn-col={ratingWnCol}
      className={cn(
        "p-0",
        hideOnMobile && styles.hiddenColumn,
        headClassName,
      )}
    >
      {/* The heading the reader sees when it is words, the tooltip when it is
          an icon: the nation, class and tier columns show a glyph, and their
          tip is the one place their name is written. */}
      <GlossaryHeadTooltip
        label={typeof children === "string" ? children : undefined}
        fallbackLabel={tooltip}
        tip={tooltip}
      >
        {button}
      </GlossaryHeadTooltip>
    </TableHead>
  );
}
