import { and, eq, gt, inArray, lte } from "drizzle-orm";
import {
  CLAN_BADGE_MAX_RANK,
  ClanBoard,
  clansByRegion,
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

  const stronghold = strongholdRatingsByRegion[region];

  const push = (clanId: number, board: ClanBoard, rank: number) => {
    const list = result.get(clanId);
    if (list) list.push({ board, rank });
    else result.set(clanId, [{ board, rank }]);
  };

  // Stronghold only. The clan ratings table was read here too, until the rating
  // crest was dropped: its top ten was the same handful of clans on all three
  // metrics, which is neither rare nor won in a competition. Removing the board
  // removed the query with it rather than leaving one whose rows were all
  // discarded on the way out.
  const strongholdRows = await db
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
    );

  // `tier` is a text column and the enum values are exactly the strings it
  // holds, so an unknown value (a board added to the table before it is added
  // here) is skipped rather than rendered as a broken badge.
  const boards = new Set<string>(Object.values(ClanBoard));
  for (const r of strongholdRows) {
    if (r.rank !== null && boards.has(r.tier)) {
      push(r.clanId, r.tier as ClanBoard, r.rank);
    }
  }

  for (const [clanId, list] of result) result.set(clanId, sortClanBadges(list));
  return result;
}

/**
 * A clan's tournament honours, for the winner's crest beside its tag.
 *
 * Straight off the denormalised clan columns, so a board of a hundred rows
 * costs one indexed lookup rather than a walk through the archive. Only the
 * clans that hold a win come back; the rest are absent and read as none.
 */
export type ClanTournamentHonours = {
  wins: number;
  featuredWins: number;
  bestTitle: string | null;
};

export async function resolveClanTournamentHonours(
  region: Region,
  clanIds: number[],
): Promise<Map<number, ClanTournamentHonours>> {
  const out = new Map<number, ClanTournamentHonours>();
  const unique = [...new Set(clanIds)];
  if (unique.length === 0) return out;
  const clans = clansByRegion[region];
  const rows = await db
    .select({
      id: clans.id,
      wins: clans.tournamentWins,
      featured: clans.tournamentFeaturedWins,
      bestTitle: clans.tournamentBestTitle,
    })
    .from(clans)
    .where(and(inArray(clans.id, unique), gt(clans.tournamentWins, 0)));
  for (const row of rows) {
    out.set(Number(row.id), {
      wins: row.wins,
      featuredWins: row.featured,
      bestTitle: row.bestTitle,
    });
  }
  return out;
}
