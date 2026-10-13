"use client";

import { useTranslation } from "@/hooks/use-translation";
import { GarageState } from "@/hooks/use-tank-filters";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Marks the two rows that are not what the table normally lists.
 *
 * `Held` carries no badge, because it is nearly every row and a badge on all of
 * them says nothing. The other two are the ones a reader would otherwise
 * misread: a sold vehicle looks like part of the garage, and an owned one with
 * no battles looks like a bug rather than the vehicle it is.
 *
 * Nothing renders at all on an unverified profile, where `state` is null,
 * since there the site genuinely cannot tell the three apart.
 */
export function GarageBadge({ state }: { state: GarageState | null }) {
  const { t } = useTranslation("components/players/detail/tanks/garage-badge");
  if (state === null || state === GarageState.Held) return null;

  const sold = state === GarageState.Sold;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            sold
              ? "shrink-0 rounded-sm border border-fd-border px-1 py-px text-[10px] font-medium text-fd-muted-foreground"
              : "shrink-0 rounded-sm border border-sky-500/40 px-1 py-px text-[10px] font-medium text-sky-400"
          }
        >
          {sold ? t("sold") : t("never-played")}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        {sold ? t("sold-hint") : t("never-played-hint")}
      </TooltipContent>
    </Tooltip>
  );
}
