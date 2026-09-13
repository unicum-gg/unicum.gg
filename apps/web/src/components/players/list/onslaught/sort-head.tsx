"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SortDirection } from "@/components/players/list/onslaught/row";

/**
 * A client-side sortable column header on the Onslaught board.
 *
 * A first click sorts that metric descending (biggest first), a second flips it.
 *
 * Generic over the column name because the board has two tables with two column
 * vocabularies (the standings, and the places that were lost), and they share
 * everything about a header except which words are valid in it.
 */
export function OnslaughtSortHead<C extends string>({
  col,
  sort,
  setSort,
  className,
  children,
}: {
  col: C;
  sort: { col: C; dir: SortDirection };
  setSort: (s: { col: C; dir: SortDirection }) => void;
  className?: string;
  children: ReactNode;
}) {
  const active = sort.col === col;
  const Icon = active
    ? sort.dir === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  return (
    <TableHead className={cn("text-right!", className)}>
      <GlossaryHeadTooltip
        label={typeof children === "string" ? children : undefined}
      >
        <button
          type="button"
          onClick={() =>
            setSort(
              active
                ? {
                    col,
                    dir:
                      sort.dir === SortDirection.Asc
                        ? SortDirection.Desc
                        : SortDirection.Asc,
                  }
                : { col, dir: SortDirection.Desc },
            )
          }
          className={cn(
            "inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 font-medium select-none hover:text-foreground",
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
            className={cn(
              "size-3.5 shrink-0",
              active ? "opacity-100" : "opacity-40",
            )}
          />
        </button>
      </GlossaryHeadTooltip>
    </TableHead>
  );
}
