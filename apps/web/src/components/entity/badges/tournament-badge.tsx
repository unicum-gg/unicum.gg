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
 * Tournament crest, worn by a player who has been on a winning roster.
 *
 * Rare enough to mean something: about 3,500 accounts across the three regions
 * hold one, and 600 of those won an event Wargaming itself flags as featured.
 * That second tier gets the gold tincture, because a win is not one thing:
 * taking the nightly gold ladder and taking the AMD Clan Showdown are the same
 * word and not the same achievement.
 *
 * The tooltip carries what the crest cannot. It says "was on the winning
 * roster" rather than "won", since a roster is who Wargaming registered and not
 * necessarily who played, and it names the event so a mark earned in 2019 does
 * not read as a thing that is true today.
 */
export function TournamentBadge({
  wins,
  featuredWins = 0,
  bestTitle = null,
  region,
  nickname,
  href: explicitHref,
  size = 16,
}: {
  wins: number;
  featuredWins?: number;
  /** The win worth naming: a featured event when there is one, else the most
   * recent. */
  bestTitle?: string | null;
  /** Where the crest leads: this player's own Tournaments tab. Both are needed
   * to build it, and without them the crest is a mark rather than a link, which
   * is what the odd caller that only holds an account id gets. */
  region?: Region;
  nickname?: string | null;
  /** Where the crest leads, when the caller already knows: the clan cluster
   * points at the clan's own Tournaments tab rather than a player's. */
  href?: string;
  size?: number;
}) {
  if (wins <= 0) return null;
  const featured = featuredWins > 0;
  const label = `${wins} tournament ${wins === 1 ? "win" : "wins"}`;
  const crest = (
    <Crest
      kind={featured ? CrestKind.TournamentFeatured : CrestKind.Tournament}
      size={size}
    />
  );
  // The full record rather than the one event the tooltip names: a reader
  // following a crest wants what this player has won, and a player with
  // twenty-nine of them has no single page that answers it.
  const href =
    explicitHref ??
    (region && nickname ? ROUTES.PLAYER_TOURNAMENTS(region, nickname) : null);
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {href ? (
            // Stops the click from reaching a row that is itself a link, the
            // same guard the streamer crest carries.
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
        <TooltipContent>
          {wins === 1 ? "Winning roster of" : `On ${wins} winning rosters,`}{" "}
          {wins === 1 ? "" : "the best "}
          {bestTitle ?? "a Wargaming tournament"}
          {featured && wins > 1 ? " · a featured event" : ""}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
