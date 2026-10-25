"use client";

import type { Region } from "@unicum.gg/wargaming";
import {
  PlayerBattlesTable,
  type PlayerBattleRow,
} from "@/components/players/detail/overview/battles-table";
import { useRatingMetric } from "@/hooks/use-rating-metric";
import ROUTES from "@/constants/routes";

/**
 * The vehicle's best battles, one per player, drawn as a player's own Battles
 * tab draws them.
 *
 * The same cards, not a table of this tab's own: the minimap, the result as a
 * coloured rail, what was fitted, the figures, the rating in the band the
 * navbar picked, and a card that opens on the full report with its roster. A
 * battle should look like the same battle wherever it appears. Each card leads
 * with the player who fought it rather than the vehicle, since every card here
 * shares the vehicle.
 *
 * Everyone listed chose to share their battles, and a player who later asks
 * not to be shown is absent from this list while still counting towards every
 * share above.
 */
export function TopBattles({
  region,
  slug,
  rows,
}: {
  region: Region;
  /** The vehicle's slug: a name leads to that player's page on it. */
  slug: string;
  rows: PlayerBattleRow[];
}) {
  // A battle has no PR or WTR, so a reader on either reads the WN fallback.
  const { wnMetric: metric } = useRatingMetric();
  if (rows.length === 0) return null;
  // Each name leads to that player's page on this vehicle, as the best players
  // board above does, rather than to their profile.
  const linked = rows.map((row) =>
    row.player
      ? {
          ...row,
          player: {
            ...row.player,
            href: ROUTES.PLAYER_TANK(region, row.player.identity.nickname, slug),
          },
        }
      : row,
  );
  return <PlayerBattlesTable region={region} metric={metric} battles={linked} />;
}
