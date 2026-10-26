"use client";

import type { Region } from "@unicum.gg/wargaming";
import {
  PlayerBattlesTable,
  type PlayerBattleRow,
} from "@/components/players/detail/overview/battles-table";
import { useRatingMetric } from "@/hooks/use-rating-metric";

/**
 * The best battles fought on this map, one per player, drawn as a player's own
 * Battles tab draws them: the same card wherever a battle appears, leading
 * with the player and the vehicle they took, since every card here shares
 * the map. A name leads to the player's profile.
 */
export function MapTopBattles({
  region,
  rows,
}: {
  region: Region;
  rows: PlayerBattleRow[];
}) {
  const { wnMetric: metric } = useRatingMetric();
  if (rows.length === 0) return null;
  return <PlayerBattlesTable region={region} metric={metric} battles={rows} withVehicle />;
}
