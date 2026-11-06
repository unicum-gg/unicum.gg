"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TranslateFunction } from "@onruntime/translations";
import { cn } from "@/lib/utils";

/**
 * A player's platoon, as the game's own results screen marks it: the number
 * before the name, counted from 1 within each team, and the reader's own
 * platoon picked out from the others.
 *
 * Rendered as an empty slot of the same width beside a player who went in
 * alone, so the names of one roster still start on one line, which is how
 * the game lays it out. `squad` is absent on every battle that has no
 * platoons at all, and the caller then renders nothing.
 */
export function SquadBadge({
  squad,
  own,
  t,
}: {
  squad: number | undefined;
  /** Whether this is the platoon of the player whose page this is. */
  own: boolean;
  t: TranslateFunction;
}) {
  if (!squad) return <span aria-hidden className="w-4 shrink-0" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] leading-none font-semibold tabular-nums",
            own
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border text-muted-foreground",
          )}
        >
          {squad}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("squad", { number: squad })}</TooltipContent>
    </Tooltip>
  );
}
