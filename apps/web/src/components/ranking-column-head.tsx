"use client";

import { CaretDownIcon, CaretUpDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A column heading on a board that is ranked SERVER-side.
 *
 * Distinct from `components/tanks/sortable-head`, and the difference is the
 * whole reason both exist: that one reorders the rows already loaded and
 * therefore toggles ascending and descending, while this one re-fetches that
 * column's true top-N, which is a different set of players rather than the same
 * set in another order. So there is no direction to toggle, and the caret marks
 * which column the board is ranked by.
 *
 * Shared because it was written twice, byte for byte, by the Steel Hunter board
 * and the stronghold table, and the marks board would have made three. The easy
 * thing to get wrong when copying it is where the padding lives (on the cell
 * here, not on the button, the opposite of the client-sort head), which draws
 * the headings offset from their own columns.
 */
export function RankingColumnHead<T extends string>({
  sortKey,
  active,
  onSort,
  className,
  /**
   * Draw no caret until this column is the one ranking the board.
   *
   * For a row of many narrow columns: the marks board draws one per tier, and
   * eleven idle carets beside eleven Roman numerals is a row of arrows with the
   * headings squeezed between them. The whole cell is still the click target,
   * so nothing is lost but the hint, and the hint is only useful on a board
   * where the sortable columns are the exception.
   */
  caretWhenIdle = true,
  children,
}: {
  sortKey: T;
  active: boolean;
  onSort: (s: T) => void;
  className?: string;
  caretWhenIdle?: boolean;
  children: ReactNode;
}) {
  const Icon = active ? CaretDownIcon : CaretUpDownIcon;
  const showCaret = active || caretWhenIdle;
  const button = (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 max-w-full min-w-0 font-medium select-none hover:text-foreground",
        active ? "text-foreground" : "",
      )}
    >
      {/* `data-head-label` is what the tooltip measures: it shows the full
          heading only when the column really cut it. */}
      <span data-head-label className="truncate">
        {children}
      </span>
      {showCaret && (
        <Icon
          weight="bold"
          className={cn(
            "size-3.5 shrink-0",
            active ? "opacity-100" : "opacity-40",
          )}
        />
      )}
    </button>
  );
  return (
    <TableHead className={cn("text-right!", className)}>
      <GlossaryHeadTooltip
        label={typeof children === "string" ? children : undefined}
      >
        {button}
      </GlossaryHeadTooltip>
    </TableHead>
  );
}
