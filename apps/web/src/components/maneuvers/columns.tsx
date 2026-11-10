"use client";

import { useCallback, useMemo, useState } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import { TableCell } from "@/components/ui/table";
import { SortDirection, type SortState } from "@/components/tanks/sortable-head";
import { useFormat } from "@/hooks/use-format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/** The columns a Maneuvers board sorts on. Fame Points is the board's own
 * order, so sorting on it is sorting by place. */
export enum ManeuversSortKey {
  FamePoints = "fame-points",
  Gain = "gain",
  Move = "move",
}

type SortableRow = {
  place: number;
  gain24h: number | null;
  placeChange24h: number | null;
};

/**
 * Client-side sorting over the rows the page already holds, shared by the
 * player and clan boards. No sort is the source's own order. Rows with no
 * figure sink to the bottom either way, since a dash is not a smallest value.
 *
 * The result is memoized: `usePagination` reads a new array as a new list and
 * resets its page, so a sort rebuilt on every render would loop.
 */
export function useManeuversSort<T extends SortableRow>(rows: T[]) {
  const [state, setState] = useState<SortState>(null);

  const toggle = useCallback((key: string) => {
    setState((prev) =>
      prev?.key !== key
        ? { key, direction: SortDirection.Desc }
        : prev.direction === SortDirection.Desc
          ? { key, direction: SortDirection.Asc }
          : null,
    );
  }, []);

  const sorted = useMemo(() => {
    if (!state) return rows;
    const value = (row: T): number | null =>
      state.key === ManeuversSortKey.Gain
        ? row.gain24h
        : state.key === ManeuversSortKey.Move
          ? row.placeChange24h
          : -row.place;
    const sign = state.direction === SortDirection.Desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null || vb == null) {
        return va == null && vb == null ? a.place - b.place : va == null ? 1 : -1;
      }
      return va === vb ? a.place - b.place : sign * (va - vb);
    });
  }, [rows, state]);

  return { sorted, state, toggle };
}

/** Fame Points gained over the last day, or a dash for a row we cannot measure. */
export function GainCell({ value }: { value: number | null }) {
  const { num } = useFormat();
  return (
    <TableCell className="text-right tabular-nums text-muted-foreground">
      {value == null ? "—" : `+${num(INT_FORMAT).format(value)}`}
    </TableCell>
  );
}

/**
 * Places climbed or lost over the last day, as an arrow and a count, or "new"
 * for a row that held no place a day ago.
 */
export function MoveCell({ value, measured }: { value: number | null; measured: boolean }) {
  const { t } = useTranslation("components/maneuvers/columns");
  const { num } = useFormat();
  if (value == null) {
    return (
      <TableCell className="text-right text-xs text-muted-foreground">
        {measured ? t("new") : "—"}
      </TableCell>
    );
  }
  const Icon = value > 0 ? CaretUpIcon : CaretDownIcon;
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        value > 0 && "text-emerald-500",
        value < 0 && "text-red-500",
        value === 0 && "text-muted-foreground",
      )}
    >
      {value === 0 ? (
        "="
      ) : (
        <span className="inline-flex items-center justify-end gap-0.5">
          <Icon weight="fill" className="size-3" aria-hidden />
          {num(INT_FORMAT).format(Math.abs(value))}
        </span>
      )}
    </TableCell>
  );
}
