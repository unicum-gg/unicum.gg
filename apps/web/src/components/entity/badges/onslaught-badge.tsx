import Link from "next/link";
import type { Region } from "@unicum.gg/wargaming";
import { Crest, CrestKind } from "@/components/entity/badges/crest";
import ROUTES from "@/constants/routes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Onslaught crest, worn by a player who has held a place on the ranked board.
 *
 * Rare by construction: the board lists only players who reach Champion, which
 * on EU is about 4,200 accounts against two million, and 630 of those reached
 * Legend. That second tier gets the violet, the same one the board paints
 * Legend in, because the two are not the same achievement: Champion is a points
 * threshold anyone can grind to, Legend is the top slice of a field and only so
 * many exist at once.
 *
 * The crest says HAS BEEN, not IS. A rating falls back under the entry bar and
 * the capture drops that player from the standings, but having been Legend is
 * not undone by a bad night, so the mark is computed from every instant we ever
 * recorded rather than from today's board.
 */
export function OnslaughtBadge({
  tier,
  bestRank = null,
  seasons = 0,
  region,
  nickname,
  size = 16,
}: {
  /** `legend` or `champion`; anything else, including null, wears nothing. */
  tier?: string | null;
  /** The best position ever held, which is what the tooltip names. */
  bestRank?: number | null;
  /** How many distinct seasons they were ranked in. */
  seasons?: number;
  /** Where the crest leads: this player's own Onslaught mode. Without both, it
   * is a mark rather than a link, like the tournament crest beside it. */
  region?: Region;
  nickname?: string | null;
  size?: number;
}) {
  const legend = tier === "legend";
  if (!legend && tier !== "champion") return null;

  const rank = legend ? "Legend" : "Champion";
  const label = `Onslaught ${rank}`;
  const crest = (
    <Crest
      kind={legend ? CrestKind.OnslaughtLegend : CrestKind.OnslaughtChampion}
      size={size}
    />
  );
  const href =
    region && nickname ? ROUTES.PLAYER_ONSLAUGHT(region, nickname) : null;

  // Said in the order a reader cares about: the rank, then how far they got,
  // then whether it was a one-off. "Reached" rather than "is", since the crest
  // is a record and not a current standing.
  const detail = [
    `Reached ${rank} in Onslaught`,
    bestRank != null ? `best #${bestRank}` : null,
    seasons > 1 ? `${seasons} seasons` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            // Stops the click from reaching a row that is itself a link, the
            // same guard the other crests carry.
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex"
              aria-label={label}
            >
              {crest}
            </Link>
          ) : (
            <span className="inline-flex" aria-label={label}>
              {crest}
            </span>
          )}
        </TooltipTrigger>
        <TooltipContent>{detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
