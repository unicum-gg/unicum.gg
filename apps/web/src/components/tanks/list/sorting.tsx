import type { ReactNode } from "react";
import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { TableHead } from "@/components/ui/table";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { cn } from "@/lib/utils";

/** Sort direction and the active sort state (which column, which way), shared by
 * every tanks-list table. */
export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}
export type SortState = { key: string; direction: SortDirection };

/** Page-size options shared by the list tables' pagination. */
export const PAGE_SIZES = [25, 50, 100, 200] as const;
export type PageSize = number | "all";

/** A sortable column header cell: click to toggle its sort, with a caret showing
 * the active direction and an optional tooltip. */
export function SortHead({
  sort,
  col,
  onToggle,
  align = "start",
  tip,
  headClassName,
  children,
}: {
  sort: SortState;
  col: string;
  onToggle: (c: string) => void;
  align?: "start" | "center" | "end";
  tip?: string;
  headClassName?: string;
  children: ReactNode;
}) {
  // The column's own definition when the glossary has one, so a header that
  // already explained itself in three words now explains itself properly.
  //
  // Matched on the heading the reader sees, not on `tip`: the tip is a sentence
  // about this column ("View range (m)"), never the term's name, so looking it
  // up by tip missed every column whose definition is anchored by label.
  const heading = typeof children === "string" ? children : undefined;
  const active = sort.key === col;
  const Icon = active
    ? sort.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  const button = (
    <button
      type="button"
      onClick={() => onToggle(col)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1 px-3 py-2 font-medium select-none hover:text-foreground",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        active && "text-foreground",
      )}
    >
      {children}
      <Icon
        weight="bold"
        className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
  return (
    <TableHead className={cn("p-0", headClassName)}>
      {/* The tip is the fallback lookup, not just a sentence: the nation, class
          and tier columns are a glyph, and their tip is the only place their
          name is written. */}
      <GlossaryHeadTooltip
        specKey={col}
        label={heading}
        fallbackLabel={tip}
        tip={tip}
      >
        {button}
      </GlossaryHeadTooltip>
    </TableHead>
  );
}
