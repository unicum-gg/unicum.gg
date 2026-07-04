"use client";

import {
  CaretDownIcon,
  CaretUpDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import { toRoman } from "roman-numerals";
import { VehicleTypeIcon } from "@/components/players/vehicle-type-icon";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { intFmt, type MetricCell, ratingCell } from "./cells";
import {
  RATING_COLOR_CLASS,
  type RatingColor,
} from "@unicum.gg/core/wargaming/wot/ratings";

export enum SortDirection {
  Asc = "asc",
  Desc = "desc",
}

export type SortColumn<TMetric extends string> =
  | { kind: "tier" }
  | { kind: "slot"; slot: number; metric: TMetric };

export type SortState<TMetric extends string> = {
  column: SortColumn<TMetric>;
  direction: SortDirection;
} | null;

export function sameColumn<TMetric extends string>(
  a: SortColumn<TMetric>,
  b: SortColumn<TMetric>,
): boolean {
  if (a.kind === "tier" && b.kind === "tier") return true;
  if (a.kind === "slot" && b.kind === "slot") {
    return a.slot === b.slot && a.metric === b.metric;
  }
  return false;
}

export const TABLE_CLASSNAME =
  "my-0! table-fixed [&_td]:py-1.5! [&_tbody_td:first-child]:pl-4! [&_thead_th:first-child]:pl-4! [&_tbody_tr]:border-b [&_tbody_tr]:border-fd-border [&_thead_tr]:border-b [&_thead_tr]:border-fd-border [&_td]:border-r [&_th]:border-r [&_td]:border-fd-border [&_th]:border-fd-border [&_td:last-child]:border-r-0 [&_th:last-child]:border-r-0";

export function SortToggle({
  active,
  direction,
  onClick,
  align,
  children,
}: {
  active: boolean;
  direction: SortDirection | null;
  onClick: () => void;
  align: "start" | "end";
  children: React.ReactNode;
}) {
  const Icon =
    active && direction === SortDirection.Asc
      ? CaretUpIcon
      : active && direction === SortDirection.Desc
        ? CaretDownIcon
        : CaretUpDownIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left font-medium select-none hover:text-foreground",
        align === "end" && "justify-end text-right",
        active ? "text-foreground" : "",
      )}
    >
      {children}
      <Icon
        weight="bold"
        className={cn("size-3.5", active ? "opacity-100" : "opacity-40")}
      />
    </button>
  );
}

export function SubHeadSort<TMetric extends string>({
  sort,
  column,
  onClick,
  label,
}: {
  sort: SortState<TMetric>;
  column: SortColumn<TMetric>;
  onClick: (col: SortColumn<TMetric>) => void;
  label: string;
}) {
  const active = !!sort && sameColumn(sort.column, column);
  return (
    <TableHead className="p-0">
      <SortToggle
        active={active}
        direction={active ? sort!.direction : null}
        onClick={() => onClick(column)}
        align="end"
      >
        <span className="text-xs text-muted-foreground">{label}</span>
      </SortToggle>
    </TableHead>
  );
}

export function VehicleLabelCell({
  tier,
  name,
  type,
  isPremium,
}: {
  tier: number;
  name: string;
  type: string | null;
  isPremium: boolean;
}) {
  return (
    <TableCell>
      <span className="flex items-center gap-2">
        {type && <VehicleTypeIcon type={type} premium={isPremium} />}
        <span className="text-xs text-muted-foreground">
          {tier > 0 ? toRoman(tier) : "—"}
        </span>
        <span
          className={cn(
            "font-medium truncate",
            isPremium && "text-[#FAB81B]",
          )}
        >
          {name}
        </span>
      </span>
    </TableCell>
  );
}

export function IntegerCell({ value }: { value: number | null }) {
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        (value === null || value === 0) && "text-muted-foreground",
      )}
    >
      {value !== null && value > 0 ? intFmt.format(value) : "—"}
    </TableCell>
  );
}

export function RatingValueCell({
  cell,
  isBest,
  showDot,
}: {
  cell: MetricCell;
  isBest: boolean;
  showDot: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "text-right tabular-nums",
        cell.color ? RATING_COLOR_CLASS[cell.color] : "text-muted-foreground",
      )}
    >
      {cell.display}
      {isBest && showDot && (
        <span
          aria-hidden
          className="ms-1.5 inline-block size-1.5 rounded-full bg-fd-primary align-middle"
        />
      )}
    </TableCell>
  );
}

export { ratingCell };
export type { MetricCell, RatingColor };
