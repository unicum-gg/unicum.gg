"use client";

import type { ReactNode } from "react";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import type { PlayerTankRow } from "@unicum.gg/shared";
import type { PlayerCellCtx } from "./vehicle-columns";

/**
 * A windowed row's figure beside how far it sits from the vehicle's career,
 * which is the question a window is asked: is the player doing better or
 * worse on this tank lately. The career figure itself is on hover. Nothing
 * extra on a career row, where either side has no figure, or where the whole
 * career sits inside the window: a vehicle bought this month would read ±0 in
 * every column, which says nothing.
 *
 * On a cell painted in its rating band the gap takes the cell's own text
 * colour: green and red on a purple or teal band are unreadable, and the sign
 * already says which way it goes.
 *
 * `diff` is the gap in the unit the cell shows (percentage points for a win
 * rate), so the sign and the colour read the same way in every column.
 */
export function withCareer(
  node: ReactNode,
  now: number | null,
  career: number | null | undefined,
  format: (value: number) => string,
  ctx: PlayerCellCtx,
  { row, onColor = false }: { row: PlayerTankRow; onColor?: boolean },
): ReactNode {
  if (!row.career) return node;
  if (now == null || career == null || row.career.battles <= row.battles) {
    // The gap's room is kept, so the figures of a column stay aligned.
    return (
      <span className="inline-flex items-baseline justify-end gap-1.5">
        {node}
        <span className="w-[5ch] text-[0.7rem]" aria-hidden />
      </span>
    );
  }
  const diff = now - career;
  const shown = format(Math.abs(diff));
  // Judged on what is printed, so a gap that rounds to nothing is not
  // coloured as a gain.
  const zero = Number(shown.replace(/[^0-9]/g, "")) === 0;
  return (
    <Hint content={ctx.t("career-value", { value: format(career) })}>
      <span className="inline-flex items-baseline justify-end gap-1.5">
        {node}
        <span
          className={cn(
            "w-[5ch] text-left text-[0.7rem] tabular-nums",
            onColor
              ? "opacity-75"
              : zero
              ? "text-fd-muted-foreground"
              : diff > 0
                ? "text-emerald-500"
                : "text-red-500",
          )}
        >
          {zero ? "±0" : `${diff > 0 ? "+" : "\u2212"}${shown}`}
        </span>
      </span>
    </Hint>
  );
}
