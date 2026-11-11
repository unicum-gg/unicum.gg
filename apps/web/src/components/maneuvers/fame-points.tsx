"use client";

import Image from "next/image";
import {
  famePointsColor,
  famePointsIconUrl,
  RATING_COLOR_CLASS,
} from "@unicum.gg/shared";
import { TableCell } from "@/components/ui/table";
import { useFormat } from "@/hooks/use-format";
import { cn } from "@/lib/utils";

const INT_FORMAT = { maximumFractionDigits: 0 } as const;

/**
 * A Fame Points figure with the game's own coin beside it. The colour is the
 * cell's business (`famePointsColor`), as it is for every rated column.
 */
export function FamePoints({
  value,
  size = 14,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const { num } = useFormat();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 tabular-nums",
        className,
      )}
    >
      {num(INT_FORMAT).format(value)}
      <Image
        src={famePointsIconUrl()}
        alt=""
        width={size}
        height={size}
        className="shrink-0"
        style={{ width: size, height: size }}
        unoptimized
      />
    </span>
  );
}

/** The Fame Points cell, painted like a rating cell by where its place
 * stands in the field. */
export function FamePointsCell({
  place,
  ranked,
  children,
}: {
  place: number;
  ranked: number;
  children: React.ReactNode;
}) {
  const color = famePointsColor(place, ranked);
  return (
    <TableCell
      className={cn(
        "text-right font-semibold",
        color != null && RATING_COLOR_CLASS[color],
      )}
    >
      {children}
    </TableCell>
  );
}

/** A Fame Points figure outside a table, painted like the board's cell so a
 * profile reads in the same colours as the row it mirrors. */
export function FamePointsBadge({
  value,
  place,
  ranked,
}: {
  value: number;
  place: number;
  ranked: number;
}) {
  const color = famePointsColor(place, ranked);
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-sm font-semibold",
        color != null && RATING_COLOR_CLASS[color],
      )}
    >
      <FamePoints value={value} />
    </span>
  );
}
