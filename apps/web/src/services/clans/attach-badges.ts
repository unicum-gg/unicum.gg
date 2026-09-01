import {
  resolveClanBadges,
  resolveClanTournamentHonours,
} from "@unicum.gg/core/clans/badges";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Attach a clan row's public crests: its board placings and its tournament
 * honours, in two indexed lookups for the whole batch.
 *
 * At the API boundary, like the player twin, so the list producers (often
 * materialized) stay free of it. `badges` is omitted rather than empty when a
 * clan holds no placing, which is the shape the boards already expect; the
 * tournament fields are omitted the same way.
 */
export async function attachClanBadges<T extends { clan_id: number }>(
  region: Region,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.clan_id);
  const [byClan, honours] = await Promise.all([
    resolveClanBadges(region, ids),
    resolveClanTournamentHonours(region, ids),
  ]);
  return rows.map((r) => {
    const badges = byClan.get(r.clan_id);
    const won = honours.get(r.clan_id);
    if (!badges?.length && !won) return r;
    return {
      ...r,
      ...(badges?.length ? { badges } : {}),
      ...(won
        ? {
            tournament_wins: won.wins,
            tournament_featured_wins: won.featuredWins,
            tournament_best_title: won.bestTitle,
          }
        : {}),
    };
  });
}
