"use client";

import { Crest, CrestKind } from "@/components/entity/badges/crest";
import { useTranslation } from "@/hooks/use-translation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Streamer crest, shown next to a player who has a linked Twitch channel — a
 * persistent identity marker, whether or not they are live right now. Links to
 * the channel; `stopPropagation` so a click goes straight to Twitch instead of
 * the surrounding row/name link. The real-time "Live" pill (`LiveBadge`) is a
 * separate status marker shown only while they are actually streaming.
 */
export function StreamerBadge({
  login,
  size = 16,
}: {
  login: string;
  size?: number;
}) {
  const { t } = useTranslation("components/entity/badges/player-badges");
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={`https://www.twitch.tv/${login}`}
            target="_blank"
            rel="nofollow noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex"
            aria-label={t("watch-on-twitch", { name: login })}
          >
            <Crest kind={CrestKind.Streamer} size={size} />
          </a>
        </TooltipTrigger>
        <TooltipContent>{t("streamer", { name: login })}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
