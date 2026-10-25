import { and, asc, eq, sql } from "drizzle-orm";
import { RATING_METRICS, RatingMetric, type ClanRankBadge, clanMembersByRegion, playersByRegion, topClansByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getClansBriefInfo } from "@unicum.gg/core/wargaming/wot/clans/listings";
import {
  computePlayerPeriodRatings,
  type PlayerPeriodRating,
  TopPlayersPeriod,
} from "@unicum.gg/core/wargaming/wot/players/top";
import { type Region } from "@unicum.gg/wargaming";
import { TopClansPeriod } from "./period";

export { TopClansPeriod } from "./period";

export type TopClanResult = {
  clan_id: number;
  tag: string;
  name: string;
  color: string;
  emblem: string | null;
  members_count: number;
  rated_members_count: number;
  avg_wnx: number;
  /** Podium positions, attached by the route rather than by this query: the
   * leaderboard SQL ranks one board, the badges span all of them. */
  badges?: ClanRankBadge[];
  /** Tournament honours, attached at the API boundary like the badges above.
   * Absent when the clan has never won one. */
  tournament_wins?: number;
  tournament_featured_wins?: number;
  tournament_best_title?: string | null;
};

const MIN_MEMBERS = 50;
const ENRICH_CANDIDATES = 30;

type RankedClan = {
  clan_id: number;
  rated_members_count: number;
  avg_wnx: number;
};

// Allowlist for the metric->column mapping used by the leaderboard SQL.
// Exported so the by-language variant can validate against the same set
// without drifting.
export const VALID_METRIC_COLUMNS: Record<string, string> = {
  wn7: "wn7",
  wn8: "wn8",
  wnx: "wnx",
  pr: "pr",
  wtr: "wtr",
};

/**
 * The lifetime board, every metric out of ONE aggregate.
 *
 * Aggregates over clan_members (portal-derived membership, refreshed per-clan
 * on demand + by clan-backfill-cron) JOINed with players for the cached rating
 * columns. Battle weight comes from clan_members overall_battles (= portal
 * `battles_count` at refresh time), matching exactly what `computeMetrics` in
 * components/clans/header uses, so the leaderboard value lines up with the
 * clan page header.
 *
 * One query for every metric rather than one per metric: the join is ~1.9s on
 * EU, and running it once per metric in parallel put five of them on the shared
 * pool at once every hour, on the job whose load already shows at the EU lunch
 * peak. `recomputeClanRatings` reads the same join the same way, and takes
 * the product in float8 for the same reason: PR and WTR are integer columns
 * whose product with a career's battles overflows int4.
 */
async function computeTopClansOverall(
  region: Region,
  limit: number,
): Promise<TopClansAllMetrics> {
  const players = playersByRegion[region];
  const clanMembers = clanMembersByRegion[region];
  const columns = RATING_METRICS.map((metric) => {
    const col = sql.raw(`p."${VALID_METRIC_COLUMNS[metric]}"`);
    const rated = sql.raw(`"${metric}_rated"`);
    const avg = sql.raw(`"${metric}_avg"`);
    return sql`COUNT(${col})::int AS ${rated},
      (
        SUM(${col}::float8 * cm.overall_battles)
          FILTER (WHERE ${col} IS NOT NULL AND cm.overall_battles > 0)
        / NULLIF(
            SUM(cm.overall_battles)
              FILTER (WHERE ${col} IS NOT NULL AND cm.overall_battles > 0),
            0
          )
      )::float8 AS ${avg}`;
  });
  const rows = (await db.execute(sql`
    SELECT cm.clan_id, ${sql.join(columns, sql`, `)}
    FROM ${clanMembers} cm
    INNER JOIN ${players} p ON p.account_id = cm.account_id
    GROUP BY cm.clan_id
    -- Filter on RATED members. A clan can declare 90+ members but only
    -- a handful actually play — those few alts with 1-3 battles at 100%
    -- WR can produce absurd battle-weighted averages (e.g. DRAKS, the
    -- Dragon Ball-themed troll clan with 4,719 avg WNX from 14 actives).
    -- Requiring 50+ rated members forces a real player base before rank.
    -- The per-metric floor is applied below; this keeps only clans that
    -- clear it on at least one.
    HAVING COUNT(*) >= ${MIN_MEMBERS}
  `)) as unknown as Array<Record<string, number | string | null>>;

  const ranked = Object.fromEntries(
    RATING_METRICS.map((metric) => [
      metric,
      rows
        .map((r) => ({
          clan_id: Number(r.clan_id),
          rated_members_count: Number(r[`${metric}_rated`] ?? 0),
          avg_wnx: r[`${metric}_avg`] == null ? null : Number(r[`${metric}_avg`]),
        }))
        .filter(
          (c): c is RankedClan =>
            c.avg_wnx !== null && c.rated_members_count >= MIN_MEMBERS,
        )
        .sort((a, b) => b.avg_wnx - a.avg_wnx)
        .slice(0, ENRICH_CANDIDATES),
    ]),
  ) as Record<RatingMetric, RankedClan[]>;

  // One batched brief lookup for the union of every board's candidates, where
  // a lookup per board asked Wargaming for the same top clans five times.
  const ids = [
    ...new Set(Object.values(ranked).flatMap((list) => list.map((c) => c.clan_id))),
  ];
  if (ids.length === 0) return emptyAllMetrics();
  const briefById = new Map(
    (await getClansBriefInfo(region, ids)).map((c) => [c.clan_id, c]),
  );

  const out = emptyAllMetrics();
  for (const metric of RATING_METRICS) {
    for (const c of ranked[metric]) {
      const brief = briefById.get(c.clan_id);
      if (!brief) continue;
      if (brief.members.length <= MIN_MEMBERS) continue;
      out[metric].push({
        clan_id: c.clan_id,
        tag: brief.tag,
        name: brief.name,
        color: brief.color,
        emblem: brief.emblem,
        members_count: brief.members.length,
        rated_members_count: c.rated_members_count,
        avg_wnx: c.avg_wnx,
      });
      if (out[metric].length >= limit) break;
    }
  }
  return out;
}

/**
 * One board per metric. A member's PR or WTR has no value over a window, so
 * the recent board averages the current figure of the members active inside
 * it, weighted by their battles there like the WN ratings.
 */
export type TopClansAllMetrics = Record<RatingMetric, TopClanResult[]>;

/**
 * Compute the clan leaderboard for one period, every metric at once.
 * Overall is one aggregate for every metric (`computeTopClansOverall`).
 * Month is the "recent form" ranking: it shares the per-member 30d ratings
 * the player leaderboard already computes, then aggregates them to clan
 * level, so the heavy snapshot diff runs once for every metric.
 */
export async function computeTopClansAllMetrics(
  region: Region,
  period: TopClansPeriod,
  limit: number,
): Promise<TopClansAllMetrics> {
  if (period === TopClansPeriod.Overall) {
    return computeTopClansOverall(region, limit);
  }
  return computeTopClansMonth(region, limit);
}

// A member needs at least this many battles over the period to count towards
// its clan's recent-form average. Low-activity members barely move a
// battle-weighted mean anyway, and this floor bounds the snapshot-diff scan
// (dropping it to >0 would recompute 30d ratings for every casual player).
const MEMBER_ACTIVE_FLOOR = 100;

// A clan needs this many active members over the period to be ranked. The
// lifetime gate (MIN_MEMBERS) proves a real player base, but the 30d average
// is only over whoever actually played — without this floor a clan with one
// hyperactive unicum tops the board on a single-player mean. Requiring a real
// active pool makes the ranking reflect team form, not one smurf.
const MIN_ACTIVE_MEMBERS = 15;

type MetricKey = RatingMetric;
const METRIC_KEYS: MetricKey[] = RATING_METRICS;
const zeroes = () =>
  Object.fromEntries(METRIC_KEYS.map((k) => [k, 0])) as Record<MetricKey, number>;

async function computeTopClansMonth(
  region: Region,
  limit: number,
): Promise<TopClansAllMetrics> {
  const players = playersByRegion[region];
  const clanMembers = clanMembersByRegion[region];

  // Gate: same as Overall — a clan needs a real player base (>= MIN_MEMBERS
  // tracked members that have battles). We pull each qualifying clan's member
  // account ids so we can overlay the 30d form of whoever was active.
  const gateRows = (await db.execute(sql`
    SELECT cm.clan_id, array_agg(cm.account_id) AS account_ids
    FROM ${clanMembers} cm
    INNER JOIN ${players} p ON p.account_id = cm.account_id
    WHERE cm.overall_battles > 0
    GROUP BY cm.clan_id
    HAVING COUNT(*) >= ${MIN_MEMBERS}
  `)) as unknown as Array<{
    clan_id: string | number;
    account_ids: Array<string | number>;
  }>;
  if (gateRows.length === 0) return emptyAllMetrics();

  // Per-member 30d ratings (shared with the player leaderboard compute).
  const ratings = await computePlayerPeriodRatings(
    region,
    TopPlayersPeriod.Month,
    MEMBER_ACTIVE_FLOOR,
  );
  if (ratings.length === 0) return emptyAllMetrics();
  const ratingByAccount = new Map<number, PlayerPeriodRating>();
  for (const r of ratings) ratingByAccount.set(r.account_id, r);

  type ClanAgg = {
    clan_id: number;
    wsum: Record<MetricKey, number>;
    bsum: Record<MetricKey, number>;
    rated: Record<MetricKey, number>;
  };
  const aggs: ClanAgg[] = [];
  for (const row of gateRows) {
    const agg: ClanAgg = {
      clan_id: Number(row.clan_id),
      wsum: zeroes(),
      bsum: zeroes(),
      rated: zeroes(),
    };
    for (const rawId of row.account_ids) {
      const rating = ratingByAccount.get(Number(rawId));
      if (!rating) continue;
      const battles = rating.battles;
      for (const k of METRIC_KEYS) {
        const value = rating[k];
        if (value == null) continue;
        agg.wsum[k] += value * battles;
        agg.bsum[k] += battles;
        agg.rated[k] += 1;
      }
    }
    aggs.push(agg);
  }

  // Rank per metric, then enrich the union of candidates with clan brief info.
  const rankedByMetric = Object.fromEntries(
    METRIC_KEYS.map((k) => [k, []]),
  ) as unknown as Record<MetricKey, Array<{ clan_id: number; avg: number; rated: number }>>;
  for (const k of METRIC_KEYS) {
    rankedByMetric[k] = aggs
      .filter((a) => a.bsum[k] > 0 && a.rated[k] >= MIN_ACTIVE_MEMBERS)
      .map((a) => ({
        clan_id: a.clan_id,
        avg: a.wsum[k] / a.bsum[k],
        rated: a.rated[k],
      }))
      .sort((x, y) => y.avg - x.avg)
      .slice(0, ENRICH_CANDIDATES);
  }

  const candidateIds = new Set<number>();
  for (const k of METRIC_KEYS) {
    for (const c of rankedByMetric[k]) candidateIds.add(c.clan_id);
  }
  if (candidateIds.size === 0) return emptyAllMetrics();
  const clansBrief = await getClansBriefInfo(region, [...candidateIds]);
  const briefById = new Map(clansBrief.map((c) => [c.clan_id, c]));

  const build = (k: MetricKey): TopClanResult[] => {
    const out: TopClanResult[] = [];
    for (const c of rankedByMetric[k]) {
      const brief = briefById.get(c.clan_id);
      if (!brief) continue;
      if (brief.members.length <= MIN_MEMBERS) continue;
      out.push({
        clan_id: c.clan_id,
        tag: brief.tag,
        name: brief.name,
        color: brief.color,
        emblem: brief.emblem,
        members_count: brief.members.length,
        rated_members_count: c.rated,
        avg_wnx: c.avg,
      });
      if (out.length >= limit) break;
    }
    return out;
  };

  const out = emptyAllMetrics();
  for (const k of METRIC_KEYS) out[k] = build(k);
  return out;
}

function emptyAllMetrics(): TopClansAllMetrics {
  return Object.fromEntries(
    RATING_METRICS.map((m) => [m, [] as TopClanResult[]]),
  ) as TopClansAllMetrics;
}

export type TopClansSnapshot = {
  results: TopClanResult[];
  computedAt: Date | null;
};

export async function getTopClansByMetric(
  region: Region,
  metric: string,
  period: TopClansPeriod,
  limit: number,
): Promise<TopClansSnapshot> {
  const topClans = topClansByRegion[region];
  const rows = await db
    .select()
    .from(topClans)
    .where(
      and(
        eq(topClans.metric, metric),
        eq(topClans.period, period),
      ),
    )
    .orderBy(asc(topClans.rank))
    .limit(limit);

  return {
    results: rows.map((r) => ({
      clan_id: r.clanId,
      tag: r.tag,
      name: r.name,
      color: r.color,
      emblem: r.emblem,
      members_count: r.membersCount,
      rated_members_count: r.ratedMembersCount,
      avg_wnx: Number(r.avgValue),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export async function getTopClansByMetricByRegions(
  regions: Region[],
  metric: string,
  period: TopClansPeriod,
  limit: number,
): Promise<Record<Region, TopClansSnapshot>> {
  const perRegion = await Promise.all(
    regions.map(
      async (region) =>
        [
          region,
          await getTopClansByMetric(region, metric, period, limit),
        ] as const,
    ),
  );
  const out = {} as Record<Region, TopClansSnapshot>;
  for (const [region, snap] of perRegion) out[region] = snap;
  return out;
}
