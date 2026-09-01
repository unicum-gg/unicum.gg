"use client";

import type { ReactNode } from "react";
import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { GlossaryHeadTooltip } from "@/components/glossary/head-tooltip";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

/** A column plus a direction, or null for the table's own order. */
export type SortState<C extends string> = {
  column: C;
  direction: SortDirection;
} | null;

/** Desc, then Asc, then back to the table's own order. */
export function nextSort<C extends string>(
  prev: SortState<C>,
  column: C,
): SortState<C> {
  if (prev?.column !== column) return { column, direction: SortDirection.Desc };
  if (prev.direction === SortDirection.Desc) {
    return { column, direction: SortDirection.Asc };
  }
  return null;
}

/**
 * The sort as `?sort=` / `?dir=`, so a re-sorted table is a link someone can
 * send.
 *
 * `dir` is omitted when descending, since that is what a first click gives and
 * carrying it would put a parameter in the URL that changes nothing. The
 * table's own order writes neither, which keeps the plain page URL clean.
 */
export function readSortFromUrl<C extends string>(
  search: string,
  isColumn: (value: string) => value is C,
): SortState<C> {
  const params = new URLSearchParams(search);
  const column = params.get("sort");
  if (!column || !isColumn(column)) return null;
  return {
    column,
    direction:
      params.get("dir") === SortDirection.Asc
        ? SortDirection.Asc
        : SortDirection.Desc,
  };
}

/** Mirrors {@link readSortFromUrl} through `history.replaceState`, so the URL
 * follows without a Next navigation or an RSC round trip. */
export function writeSortToUrl<C extends string>(state: SortState<C>): void {
  const params = new URLSearchParams(window.location.search);
  if (state) {
    params.set("sort", state.column);
    if (state.direction === SortDirection.Asc) params.set("dir", state.direction);
    else params.delete("dir");
  } else {
    params.delete("sort");
    params.delete("dir");
  }
  const qs = params.toString();
  window.history.replaceState(
    null,
    "",
    qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
  );
}

/**
 * Compare two already-extracted sort values, in the shape every table here
 * needs: strings collate, numbers subtract, and a tie falls back to the table's
 * own order so a column of equal values does not shuffle.
 */
export function compareValues(
  a: number | string,
  b: number | string,
): number {
  return typeof a === "string" && typeof b === "string"
    ? a.localeCompare(b)
    : (a as number) - (b as number);
}

/**
 * A sortable heading, in the shape the leaderboards use: the padding stays on
 * the cell and the button is inline, so a sortable column is exactly as tall as
 * a plain one.
 */
export function SortHead<C extends string>({
  column,
  state,
  onToggle,
  className,
  label,
  children,
}: {
  column: C;
  state: SortState<C>;
  onToggle: (column: C) => void;
  className?: string;
  /** Glossary term this heading stands for, when it is not the plain text. */
  label?: string;
  children: ReactNode;
}) {
  const active = state?.column === column;
  const Icon = active
    ? state.direction === SortDirection.Asc
      ? CaretUpIcon
      : CaretDownIcon
    : CaretUpDownIcon;
  return (
    <TableHead className={className}>
      <GlossaryHeadTooltip
        label={label ?? (typeof children === "string" ? children : undefined)}
      >
        <button
          type="button"
          onClick={() => onToggle(column)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 font-medium whitespace-nowrap select-none hover:text-foreground",
            active && "text-foreground",
          )}
        >
          {children}
          <Icon
            weight="bold"
            className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
          />
        </button>
      </GlossaryHeadTooltip>
    </TableHead>
  );
}
