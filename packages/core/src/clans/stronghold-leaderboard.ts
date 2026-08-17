import { sql } from "drizzle-orm";
import {
  SR_BOOST_SCALE,
  STRONGHOLD_MIN_BATTLES,
  StrongholdPeriod,
  StrongholdTier,
  type StrongholdRatingsTable,
  clanMembersByRegion,
  clanSnapshotsByRegion,
  clansByRegion,
  strongholdRatingsByRegion,
} from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { type Region } from "@unicum.gg/wargaming";

// Postgres caps a statement at 65535 bind params; ~15 cols/row means we stay
// well under with 2000-row insert chunks.
const INSERT_CHUNK = 2000;

// The transaction executor `db.transaction` hands its callback. Slices run
// through it so they share the session-scoped `_sh_roster` temp table.
type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

// Which snapshot columns back each tier. Advances (15v15) shares the Skirmish
// T10 ELO rating in WG's data, but has its own battle/win counters.
function tierColumns(tier: StrongholdTier): {
  elo: string | null;
  battles: string;
  wins: string;
} {
  switch (tier) {
    case StrongholdTier.T10:
      return {
        elo: "elo_t10",
        battles: "skirmish_battles_t10",
        wins: "skirmish_wins_t10",
      };
    case StrongholdTier.T8:
      return {
        elo: "elo_t8",
        battles: "skirmish_battles_t8",
        wins: "skirmish_wins_t8",
      };
    case StrongholdTier.T6:
      return {
        elo: "elo_t6",
        battles: "skirmish_battles_t6",
        wins: "skirmish_wins_t6",
      };
    case StrongholdTier.Advances:
      return {
        elo: "elo_t10",
        battles: "advances_battles_t10",
        wins: "advances_wins_t10",
      };
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

// SR = roster strength x win-rate factor x roster maturity. A pure *skill*
// rating, independent of how much a clan has played (that is SRB's job, which
// rewards volume on top of this). The min-battles gate below keeps a tiny lucky
// sample off the board without a volume brake inside the rating itself.
//   - Roster strength is the *median* WG Personal Rating *above a competitive
//     baseline* (`SR_PR_FLOOR`): a ~4.5k PR is a roughly average player, while
//     competitive rosters sit at 7k+, so crediting PR from zero barely separates
//     a farm roster from an elite one. Measuring above the floor makes roster
//     quality the dominant axis. The median (not the mean) shrugs off the low
//     tail of reroll/alt accounts and the high tail of a couple of carries.
//   - Win factor is neutral at 50% WR, super-linear so dominance is rewarded.
//   - Roster maturity discounts boosting: strongholds (esp. Advances 15v15) get
//     farmed with "boost" accounts, small accounts with almost no random battles
//     that exist only to play stronghold. Their lack of a random-battle history
//     can't be faked, so `SR_BOOST_SCALE` weighs each member toward boost as its
//     random-battle count drops, and a boost-heavy roster is scaled down.
const SR_PR_FLOOR = 4500;

function srExpr(p: { battles: string; wins: string }): string {
  // `greatest(wins, 0)` clamps the win-rate base to >= 0: a 30-day window can
  // have a negative win diff (a snapshot correction), and `power()` throws on a
  // negative base raised to a fractional exponent. Maturity is floored at 0.05
  // so an all-reroll roster still scores > 0 rather than vanishing.
  return `CASE WHEN ${p.battles} > 0 THEN round(
    greatest(roster.median_pr - ${SR_PR_FLOOR}, 50)
    * power(greatest(${p.wins}::float, 0) / ${p.battles} / 0.5, 1.5)
    * power(greatest(1 - coalesce(roster.boost_ratio, 0), 0.05), 1.5)
  ) ELSE NULL END`;
}

const TIERS: StrongholdTier[] = [
  StrongholdTier.Advances,
  StrongholdTier.T10,
  StrongholdTier.T8,
  StrongholdTier.T6,
];
const PERIODS: StrongholdPeriod[] = [
  StrongholdPeriod.Overall,
  StrongholdPeriod.Month,
];

type RawRow = {
  clan_id: string | number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  languages: string[] | null;
  members_count: number;
  elo: number | null;
  battles: number;
  wins: number;
  personal_rating: number | null;
  boost_ratio: number | string | null;
  sr: number | string | null;
  is_active: boolean;
};

type InsertValue = StrongholdRatingsTable["$inferInsert"];

// Every qualifying clan (min battles + active in the last 30 days) for one
// (tier, period), with all metrics computed. Same body as the former live query
// minus the ORDER BY / LIMIT, so the materialized table holds the full slice and
// the endpoint applies the sort + top-100 at read time.
async function computeStrongholdRows(
  tx: Tx,
  region: Region,
  tier: StrongholdTier,
  period: StrongholdPeriod,
): Promise<RawRow[]> {
  const snapshots = clanSnapshotsByRegion[region];
  const clans = clansByRegion[region];
  const cols = tierColumns(tier);
  const p = periodExprs(cols, period);

  const battlesCol = sql.raw(cols.battles);
  const winsCol = sql.raw(cols.wins);
  const eloCol = cols.elo ? sql.raw(cols.elo) : null;
  const battlesRaw = sql.raw(p.battles);
  const winsRaw = sql.raw(p.wins);
  const srRaw = sql.raw(srExpr(p));
  const minBattlesRaw = sql.raw(String(STRONGHOLD_MIN_BATTLES[tier]));

  return (await tx.execute(sql`
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
    )
    -- roster (median PR + boost signal) is tier- and period-independent, so it
    -- is built once per region into the _sh_roster temp table by the caller and
    -- joined here, instead of the ~10s percentile scan being recomputed in every
    -- one of the 8 (tier x period) slices.
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
      ${srRaw} AS sr,
      -- Active = a positive 30-day battle diff (a null baseline reads as
      -- inactive). The board filters on this so it only ranks currently-active
      -- clans; the clan page ignores it. We materialize every min-battles clan
      -- (not only active ones) so a clan's own SR on a tier it played but hasn't
      -- touched in 30 days is still readable on its page.
      COALESCE((latest.${battlesCol} - b30.battles) > 0, false) AS is_active
    FROM latest
    JOIN ${clans} c ON c.id = latest.clan_id
    LEFT JOIN baseline_30d b30 ON b30.clan_id = latest.clan_id
    LEFT JOIN _sh_roster roster ON roster.clan_id = latest.clan_id
    WHERE c.is_disbanded = false
  `)) as unknown as RawRow[];
}

/**
 * Recompute the materialized stronghold leaderboard for a region: run the
 * (tier x period) aggregations (the ~3s snapshots x members scan, ×8) and
 * replace the region's `stronghold_ratings` table. Paid once per hour in the
 * background so the board serves every (tier, sort, period) slice from a cheap
 * indexed read. Returns the total row count written.
 */
export async function recomputeStrongholdRatings(
  region: Region,
): Promise<number> {
  const table = strongholdRatingsByRegion[region];
  const members = clanMembersByRegion[region];
  const values: InsertValue[] = [];

  await db.transaction(async (tx) => {
    // `roster` (median PR + boost signal per clan) is tier- and period-
    // independent, but the slice query used to recompute it — a ~10s percentile
    // scan over ~1.5M members — inside every one of the 8 (tier x period)
    // slices. Build it once here into a temp table the slices join, cutting a
    // region's stronghold recompute from ~90s to ~18s. ON COMMIT DROP so it
    // never outlives this transaction; JIT off matches the by-language service
    // (compile overhead dwarfs a single execution of these one-shot shapes).
    await tx.execute(sql`SET LOCAL jit = off`);
    await tx.execute(sql`
      CREATE TEMP TABLE _sh_roster ON COMMIT DROP AS
      SELECT clan_id,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY personal_rating)
          FILTER (WHERE personal_rating IS NOT NULL) AS median_pr,
        avg(1.0 / (1.0 + power(overall_battles::float / ${sql.raw(String(SR_BOOST_SCALE))}, 2)))
          FILTER (WHERE overall_battles IS NOT NULL) AS boost_ratio
      FROM ${members}
      GROUP BY clan_id
    `);

    for (const tier of TIERS) {
      for (const period of PERIODS) {
        const rows = await computeStrongholdRows(tx, region, tier, period);

        // Rank within this (tier, period) board, computed here so the read side
        // never re-sorts. Two things this must not get wrong:
        //  - `computeStrongholdRows` drops the board's ORDER BY on purpose (it
        //    materialises the whole slice, see its note), so the rows arrive in
        //    whatever order Postgres produced them. They have to be sorted here.
        //  - only active clans are ranked. The board hides the rest, so a dormant
        //    clan would otherwise badge a position it no longer occupies.
        const ranked = new Map<string, number>();
        const active = rows
          .filter((r) => r.is_active && r.sr !== null)
          .sort((a, b) => Number(b.sr) - Number(a.sr));
        let rank = 0;
        let previousSr: number | null = null;
        active.forEach((r, i) => {
          const sr = Number(r.sr);
          if (sr !== previousSr) {
            rank = i + 1;
            previousSr = sr;
          }
          ranked.set(String(r.clan_id), rank);
        });

        for (const r of rows) {
          values.push({
            rank: ranked.get(String(r.clan_id)) ?? null,
            tier,
            period,
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
            personalRating:
              r.personal_rating === null ? null : Number(r.personal_rating),
            boostRatio: r.boost_ratio === null ? null : String(r.boost_ratio),
            sr: r.sr === null ? null : String(r.sr),
            isActive: r.is_active,
          });
        }
      }
    }

    await tx.delete(table);
    for (let i = 0; i < values.length; i += INSERT_CHUNK) {
      await tx.insert(table).values(values.slice(i, i + INSERT_CHUNK));
    }
  });

  return values.length;
}
