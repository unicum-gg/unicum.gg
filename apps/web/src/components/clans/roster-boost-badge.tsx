import { useTranslation } from "@/hooks/use-translation";
import { WarningIcon } from "@phosphor-icons/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BOOST_BADGE_MIN } from "@unicum.gg/shared";

/**
 * The amber "boost roster" badge: the share of a clan's roster that reads as
 * boost accounts (very few random battles, farmed only to inflate stronghold
 * results). Renders nothing below BOOST_BADGE_MIN, since every clan carries a
 * handful. Shared by the stronghold leaderboard and the clan page header.
 */
export function RosterBoostBadge({
  boostRatio,
}: {
  boostRatio: number | null;
}) {
  const { t } = useTranslation("components/clans/roster-boost-badge");
  if (boostRatio === null || boostRatio < BOOST_BADGE_MIN) return null;
  const pct = Math.round(boostRatio * 100);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-500">
            <WarningIcon weight="fill" className="size-3" />
            {pct}%
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("of-this-roster-read-as", { pct })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
