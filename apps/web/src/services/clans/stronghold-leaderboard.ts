import { sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { STRONGHOLD_MIN_BATTLES, StrongholdPeriod, StrongholdSort, StrongholdTier, clanSnapshotsByRegion, clanMembersByRegion, clansByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import type { Region } from "@unicum.gg/wargaming";

export type StrongholdLeaderboardEntry = {
  clanId: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  languages: string[];
  membersCount: number;
  elo: number | null;
  /** Battles over the selected period (all-time, or the last-30-days diff). */
  battles: number;
  /** Wins over the selected period. */
  wins: number;
  /** Median WG Personal Rating (WGR) of the clan's roster. */
  personalRating: number | null;
  /** Share of the roster that reads as boost accounts, by low random-battle count (0..1). */
  boostRatio: number | null;
  /** Composite skirmish rating for the period: roster x win rate x volume x maturity. */
  sr: number | null;
};

type RawEntry = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string;
  languages: string[];
  members_count: number;
  elo: number | null;
  battles: number;
  wins: number;
  personal_rating: number | null;
  boost_ratio: number | null;
  sr: number | null;
};

function tierColumns(tier: StrongholdTier): {
  elo: string | null;
  battles: string;
  wins: string;
} {
  switch (tier) {
    case StrongholdTier.T10:
      return { elo: "elo_t10", battles: "skirmish_battles_t10", wins: "skirmish_wins_t10" };
    case StrongholdTier.T8:
      return { elo: "elo_t8", battles: "skirmish_battles_t8", wins: "skirmish_wins_t8" };
    case StrongholdTier.T6:
      return { elo: "elo_t6", battles: "skirmish_battles_t6", wins: "skirmish_wins_t6" };
    case StrongholdTier.Advances:
      // Advances (15v15) shares the Skirmish T10 ELO rating in WG's data.
      return { elo: "elo_t10", battles: "advances_battles_t10", wins: "advances_wins_t10" };
  }
}

// Battles / wins over the selected period: all-time totals, or the diff against
// the ~30-day baseline snapshot. Both windows share the same 30-day-active
// filter, so the diff is always defined and positive.
function periodExprs(
  cols: ReturnType<typeof tierColumns>,
  period: StrongholdPeriod,
): { battles: string; wins: string } {
  if (period === StrongholdPeriod.Month) {
    return {
      battles: `(latest.${cols.battles} - b30.battles)`,
      wins: `(latest.${cols.wins} - b30.wins)`,
    };
  }
  return { battles: `latest.${cols.battles}`, wins: `latest.${cols.wins}` };
}

function sortExpr(
  sort: StrongholdSort,
  p: { battles: string; wins: string },
): string {
  switch (sort) {
    case StrongholdSort.Elo:
      return `elo DESC NULLS LAST`;
    case StrongholdSort.Battles:
      return `battles DESC NULLS LAST`;
    case StrongholdSort.Winrate:
      return `CASE WHEN ${p.battles} > 0 THEN ${p.wins}::float / ${p.battles} ELSE NULL END DESC NULLS LAST`;
    case StrongholdSort.Rating:
      // The composite SR (computed as an output column below); a standalone
      // alias is allowed in ORDER BY.
      return `sr DESC NULLS LAST`;
  }
}

// SR = roster strength x win-rate factor x volume confidence x roster maturity.
//   - Roster strength is the *median* WG Personal Rating *above a competitive
//     baseline* (`SR_PR_FLOOR`): a ~4.5k PR is a roughly average player, while
//     competitive rosters sit at 7k+, so crediting PR from zero barely separates
//     a farm roster from an elite one (9.4k / 5.6k is only 1.7x). Measuring above
//     the floor makes roster quality the dominant axis. The median (not the mean)
//     shrugs off the low tail of reroll/alt accounts and the high tail of a
//     couple of carries, so it reflects the roster's typical real player.
//   - Win factor is neutral at 50% WR, super-linear so dominance is rewarded.
//   - Volume saturates (a confidence discount for tiny samples, not a reward for
//     grinding). `k` is the half-credit point: all-time counts run to the
//     thousands, a 30-day window only to the tens/hundreds, so the window uses a
//     much smaller k so a mid-roster clan cannot climb on battle count alone.
//   - Roster maturity discounts boosting: strongholds (esp. Advances 15v15, which
//     needs >=10 clan members per battle) get farmed with "boost" accounts, small
//     accounts with almost no random battles that exist only to play stronghold.
//     Their lack of a random-battle history can't be faked, so `SR_BOOST_SCALE`
//     weighs each member toward boost as its random-battle count drops, and a
//     boost-heavy roster is scaled down. (This is battle count, not skill: a
//     genuine "reroll", a strong player on a fresh account, is caught the same
//     way, but the median PR already credits any real skill separately.)
const SR_PR_FLOOR = 4500;
// Random-battle count at which a member counts as "half boost" (soft, no hard
// cutoff): weight = 1 / (1 + (overall_battles / SCALE)^2). Members with an
// unknown battle count (not yet fetched) are excluded, not assumed to be boosts.
const SR_BOOST_SCALE = 2000;

function srExpr(p: { battles: string; wins: string }, k: number): string {
  // `greatest(wins, 0)` clamps the win-rate base to >= 0: a 30-day window can
  // have a negative win diff (a snapshot correction), and `power()` throws on a
  // negative base raised to a fractional exponent. Maturity is floored at 0.05
  // so an all-reroll roster still scores > 0 rather than vanishing.
  return `CASE WHEN ${p.battles} > 0 THEN round(
    greatest(roster.median_pr - ${SR_PR_FLOOR}, 50)
    * power(greatest(${p.wins}::float, 0) / ${p.battles} / 0.5, 1.5)
    * (${p.battles}::float / (${p.battles} + ${k}))
    * power(greatest(1 - coalesce(roster.boost_ratio, 0), 0.05), 1.5)
  ) ELSE NULL END`;
}

const SR_VOLUME_K: Record<StrongholdPeriod, number> = {
  [StrongholdPeriod.Overall]: 300,
  [StrongholdPeriod.Month]: 30,
};

async function fetchStrongholdLeaderboard(
  region: Region,
  tier: StrongholdTier,
  sort: StrongholdSort,
  period: StrongholdPeriod,
  limit: number,
): Promise<StrongholdLeaderboardEntry[]> {
  const snapshots = clanSnapshotsByRegion[region];
  const clans = clansByRegion[region];
  const members = clanMembersByRegion[region];
  const cols = tierColumns(tier);
  const p = periodExprs(cols, period);

  const battlesCol = sql.raw(cols.battles);
  const winsCol = sql.raw(cols.wins);
  const eloCol = cols.elo ? sql.raw(cols.elo) : null;
  const battlesRaw = sql.raw(p.battles);
  const winsRaw = sql.raw(p.wins);
  const sortRaw = sql.raw(sortExpr(sort, p));
  const srRaw = sql.raw(srExpr(p, SR_VOLUME_K[period]));
  const limitRaw = sql.raw(String(limit));
  const minBattlesRaw = sql.raw(String(STRONGHOLD_MIN_BATTLES[tier]));

  const rows = (await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (clan_id) *
      FROM ${snapshots}
      WHERE ${battlesCol} IS NOT NULL AND ${battlesCol} >= ${minBattlesRaw}
      ORDER BY clan_id, taken_at DESC
    ),
    baseline_30d AS (
      -- Mirror the clan page's baseline (getClanSnapshotPeriods.periodBaseline):
      -- per clan, the newest snapshot at or before J-30, else the oldest one
      -- before the latest. Advances history is only weeks deep and season-
      -- sparse, so a strict ">30d old" cutoff leaves it empty for nearly every
      -- clan; this fallback keeps the 30d window consistent with the clan page.
      SELECT DISTINCT ON (s.clan_id) s.clan_id, s.${battlesCol} AS battles, s.${winsCol} AS wins
      FROM ${snapshots} s
      JOIN latest l ON l.clan_id = s.clan_id
      WHERE s.taken_at < l.taken_at
      ORDER BY s.clan_id,
        (s.taken_at <= now() - interval '30 days') DESC,
        CASE WHEN s.taken_at <= now() - interval '30 days' THEN s.taken_at END DESC,
        s.taken_at ASC
    ),
    roster AS (
      -- Roster strength + boost signal from the clan's current members:
      --  * median_pr   = median WG Personal Rating (typical real player, robust
      --                  to boost-account lows and carry highs)
      --  * boost_ratio = mean per-member boost weight (soft, by random-battle
      --                  count); high = a roster padded with boost accounts.
      SELECT clan_id,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY personal_rating)
          FILTER (WHERE personal_rating IS NOT NULL) AS median_pr,
        avg(1.0 / (1.0 + power(overall_battles::float / ${sql.raw(String(SR_BOOST_SCALE))}, 2)))
          FILTER (WHERE overall_battles IS NOT NULL) AS boost_ratio
      FROM ${members}
      GROUP BY clan_id
    )
    SELECT
      c.id AS clan_id,
      c.tag,
      c.name,
      c.color,
      COALESCE(c.emblem, '') AS emblem,
      c.languages,
      c.members_count,
      ${eloCol ? sql`latest.${eloCol} AS elo,` : sql`NULL::integer AS elo,`}
      ${battlesRaw} AS battles,
      ${winsRaw} AS wins,
      round(roster.median_pr) AS personal_rating,
      round(roster.boost_ratio::numeric, 3) AS boost_ratio,
      ${srRaw} AS sr
    FROM latest
    JOIN ${clans} c ON c.id = latest.clan_id
    LEFT JOIN baseline_30d b30 ON b30.clan_id = latest.clan_id
    LEFT JOIN roster ON roster.clan_id = latest.clan_id
    -- Only rank clans active in the last 30 days (a positive 30-day battle diff).
    WHERE c.is_disbanded = false
      AND (latest.${battlesCol} - b30.battles) > 0
    ORDER BY ${sortRaw}
    LIMIT ${limitRaw}
  `)) as unknown as RawEntry[];

  return rows.map((r) => ({
    clanId: Number(r.clan_id),
    tag: r.tag,
    name: r.name,
    color: r.color,
    emblem: r.emblem,
    languages: r.languages ?? [],
    membersCount: Number(r.members_count),
    elo: r.elo === null ? null : Number(r.elo),
    battles: Number(r.battles),
    wins: Number(r.wins),
    personalRating: r.personal_rating === null ? null : Number(r.personal_rating),
    boostRatio: r.boost_ratio === null ? null : Number(r.boost_ratio),
    sr: r.sr === null ? null : Number(r.sr),
  }));
}

export const getStrongholdLeaderboard = unstable_cache(
  fetchStrongholdLeaderboard,
  ["stronghold-leaderboard"],
  { revalidate: 600, tags: ["stronghold-leaderboard"] },
);
