import { and, eq, inArray, lte } from "drizzle-orm";
import {
  CLAN_BADGE_MAX_RANK,
  ClanBoard,
  clanRatingsByRegion,
  sortClanBadges,
  strongholdRatingsByRegion,
  type ClanRankBadge,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";

/** The stronghold board a badge speaks for. Only the all-time board earns one:
 * the 30-day board is the same clans on a shorter window, so badging both would
 * hand a clan two pastilles for one achievement. */
const STRONGHOLD_PERIOD = "overall";

/**
 * Podium positions for a set of clans, keyed by clan id.
 *
 * Mirrors `resolvePlayerBadges`: one batched call for a whole page of rows,
 * resolved server-side, clans with nothing simply absent (callers treat a
 * missing entry as "no badges").
 *
 * Both reads are indexed lookups on `clan_id` against tables the hourly cron
 * already ranked, so this costs well under a millisecond. Ranking at read time
 * instead would be a full sort of each board — measured at 410 ms for a single
 * clan, and a leaderboard would pay it per row.
 */
export async function resolveClanBadges(
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanRankBadge[]>> {
  const result = new Map<number, ClanRankBadge[]>();
  const unique = [...new Set(clanIds)];
  if (unique.length === 0) return result;

  const ratings = clanRatingsByRegion[region];
  const stronghold = strongholdRatingsByRegion[region];

  const push = (clanId: number, board: ClanBoard, rank: number) => {
    const list = result.get(clanId);
    if (list) list.push({ board, rank });
    else result.set(clanId, [{ board, rank }]);
  };

  const [ratingRows, strongholdRows] = await Promise.all([
    db
      .select({
        clanId: ratings.clanId,
        metric: ratings.metric,
        rank: ratings.rank,
      })
      .from(ratings)
      .where(
        and(
          inArray(ratings.clanId, unique),
          lte(ratings.rank, CLAN_BADGE_MAX_RANK),
        ),
      ),
    db
      .select({
        clanId: stronghold.clanId,
        tier: stronghold.tier,
        rank: stronghold.rank,
      })
      .from(stronghold)
      .where(
        and(
          inArray(stronghold.clanId, unique),
          eq(stronghold.period, STRONGHOLD_PERIOD),
          lte(stronghold.rank, CLAN_BADGE_MAX_RANK),
        ),
      ),
  ]);

  // `metric` and `tier` are text columns, and the enum values are exactly the
  // strings they hold, so an unknown value (a board added to the table before
  // it is added here) is skipped rather than rendered as a broken badge.
  const boards = new Set<string>(Object.values(ClanBoard));
  for (const r of ratingRows) {
    if (r.rank !== null && boards.has(r.metric)) {
      push(r.clanId, r.metric as ClanBoard, r.rank);
    }
  }
  for (const r of strongholdRows) {
    if (r.rank !== null && boards.has(r.tier)) {
      push(r.clanId, r.tier as ClanBoard, r.rank);
    }
  }

  for (const [clanId, list] of result) result.set(clanId, sortClanBadges(list));
  return result;
}
