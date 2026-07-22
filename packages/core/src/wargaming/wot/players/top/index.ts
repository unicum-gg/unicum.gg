import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { RatingMetric, playersByRegion, topPlayersByRegion } from "@unicum.gg/shared";
import { db } from "@unicum.gg/core/db";
import { getPlayerClansBatch } from "@unicum.gg/core/wargaming/wot/clans/listings";
import { type Region } from "@unicum.gg/wargaming";
import { TopPlayersPeriod } from "./period";

export { TopPlayersPeriod } from "./period";

const MIN_BATTLES: Record<TopPlayersPeriod, number> = {
  [TopPlayersPeriod.Day]: 20,
  [TopPlayersPeriod.Week]: 140,
  [TopPlayersPeriod.Month]: 600,
  [TopPlayersPeriod.Overall]: 20000,
};

const ENRICH_CANDIDATES = 30;

export type TopPlayerResult = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  wnx: number;
};

export type TopPlayersAllMetrics = {
  [RatingMetric.Wn7]: TopPlayerResult[];
  [RatingMetric.Wn8]: TopPlayerResult[];
  [RatingMetric.Wnx]: TopPlayerResult[];
};

export async function computeTopPlayersAllMetrics(
  region: Region,
  period: TopPlayersPeriod,
  limit: number,
): Promise<TopPlayersAllMetrics> {
  // Overall ratings are already cached on the players row by snapshot-cron,
  // so the lifetime ranking is just a SELECT + ORDER BY on each column. No
  // need to scan tens of millions of tank_snapshots and recompute.
  if (period === TopPlayersPeriod.Overall) {
    return computeOverallFromCache(region, limit);
  }

  const ratings = await computePlayerPeriodRatings(
    region,
    period,
    MIN_BATTLES[period],
  );
  if (ratings.length === 0) {
    return {
      [RatingMetric.Wn7]: [],
      [RatingMetric.Wn8]: [],
      [RatingMetric.Wnx]: [],
    };
  }

  function topByScore(field: "wn7" | "wn8" | "wnx"): TopPlayerResult[] {
    return ratings
      .filter(
        (s): s is PlayerPeriodRating & { [K in typeof field]: number } =>
          s[field] !== null,
      )
      .sort((a, b) => b[field] - a[field])
      .slice(0, ENRICH_CANDIDATES)
      .map((s) => ({
        account_id: s.account_id,
        nickname: s.nickname,
        clan_tag: null,
        clan_color: null,
        battles: s.battles,
        wnx: s[field],
      }));
  }

  const out: TopPlayersAllMetrics = {
    [RatingMetric.Wn7]: topByScore("wn7"),
    [RatingMetric.Wn8]: topByScore("wn8"),
    [RatingMetric.Wnx]: topByScore("wnx"),
  };

  // Enrich the UNION of all 3 top lists with clan info in one batch.
  const uniqueIds = new Set<number>();
  for (const m of Object.values(out)) {
    for (const r of m) uniqueIds.add(r.account_id);
  }
  if (uniqueIds.size === 0) return out;
  const clansByAccount = await getPlayerClansBatch(region, [...uniqueIds]);
  for (const list of Object.values(out)) {
    for (const r of list) {
      const clan = clansByAccount.get(r.account_id);
      if (clan) {
        r.clan_tag = clan.tag;
        r.clan_color = clan.color;
      }
    }
  }

  // Trim each list to the requested limit (was working off ENRICH_CANDIDATES).
  return {
    [RatingMetric.Wn7]: out[RatingMetric.Wn7].slice(0, limit),
    [RatingMetric.Wn8]: out[RatingMetric.Wn8].slice(0, limit),
    [RatingMetric.Wnx]: out[RatingMetric.Wnx].slice(0, limit),
  };
}

/**
 * Per-player period ratings for every active player in a region, WITHOUT the
 * top-N slicing or clan enrichment. Shared by the player leaderboard (which
 * then ranks + enriches per metric) and the clan leaderboard (which aggregates
 * these per-member scores into a clan-level battle-weighted average). The
 * `minBattles` floor gates who counts as "active" over the period: the player
 * leaderboard passes its per-period minimum, the clan aggregation a lower floor
 * so more members contribute (their weight is their period battle count).
 */
export type PlayerPeriodRating = {
  account_id: number;
  nickname: string;
  battles: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
};

export async function computePlayerPeriodRatings(
  region: Region,
  period: TopPlayersPeriod,
  minBattles: number,
): Promise<PlayerPeriodRating[]> {
  const players = playersByRegion[region];
  // The snapshot pipeline keeps a cached recent-window rating per period on the
  // players row (see players/index.ts updatePlayerRatings), in lockstep with
  // every snapshot. So this is a single indexed read of the ~2M-row players
  // table instead of a DISTINCT-ON seq scan + on-disk sort over the 300M-row
  // tank_snapshots table every hour — the same idea the Overall fast path uses.
  // The window is relative to each player's last snapshot rather than exactly
  // now, but leaderboard players are active (re-snapshotted within hours), so it
  // tracks closely and self-corrects on their next snapshot.
  const byPeriod = {
    [TopPlayersPeriod.Day]: {
      battles: players.battles24h,
      wn7: players.wn724h,
      wn8: players.wn824h,
      wnx: players.wnx24h,
    },
    [TopPlayersPeriod.Week]: {
      battles: players.battles7d,
      wn7: players.wn77d,
      wn8: players.wn87d,
      wnx: players.wnx7d,
    },
    [TopPlayersPeriod.Month]: {
      battles: players.battles30d,
      wn7: players.wn730d,
      wn8: players.wn830d,
      wnx: players.wnx30d,
    },
    [TopPlayersPeriod.Overall]: null,
  };
  const cols = byPeriod[period];
  if (!cols) {
    throw new Error(
      `computePlayerPeriodRatings: unexpected period ${period}`,
    );
  }

  const rows = await db
    .select({
      account_id: players.accountId,
      nickname: players.nickname,
      battles: cols.battles,
      wn7: cols.wn7,
      wn8: cols.wn8,
      wnx: cols.wnx,
    })
    .from(players)
    .where(gte(cols.battles, minBattles));

  return rows.map((r) => ({
    account_id: Number(r.account_id),
    nickname: r.nickname,
    battles: r.battles ?? 0,
    wn7: r.wn7,
    wn8: r.wn8,
    wnx: r.wnx,
  }));
}

/**
 * Overall ranking fast path: the players row holds the cached lifetime
 * wn7/wn8/wnx (refreshed by snapshot-cron) plus `battles`. So the lifetime
 * top 30 is a single typed Drizzle query per metric, no raw SQL, no
 * DISTINCT-ON scan of any snapshot table.
 */
async function computeOverallFromCache(
  region: Region,
  limit: number,
): Promise<TopPlayersAllMetrics> {
  const minBattles = MIN_BATTLES[TopPlayersPeriod.Overall];
  const players = playersByRegion[region];

  const fetchTop = async (
    column: typeof players.wn7 | typeof players.wn8 | typeof players.wnx,
  ): Promise<TopPlayerResult[]> => {
    const rows = await db
      .select({
        accountId: players.accountId,
        nickname: players.nickname,
        battles: players.battles,
        value: column,
      })
      .from(players)
      .where(and(gte(players.battles, minBattles), isNotNull(column)))
      .orderBy(desc(column))
      .limit(ENRICH_CANDIDATES);
    return rows.map((r) => ({
      account_id: Number(r.accountId),
      nickname: r.nickname,
      clan_tag: null,
      clan_color: null,
      battles: r.battles ?? 0,
      wnx: Number(r.value),
    }));
  };

  const [wn7, wn8, wnx] = await Promise.all([
    fetchTop(players.wn7),
    fetchTop(players.wn8),
    fetchTop(players.wnx),
  ]);

  const out: TopPlayersAllMetrics = {
    [RatingMetric.Wn7]: wn7,
    [RatingMetric.Wn8]: wn8,
    [RatingMetric.Wnx]: wnx,
  };

  const uniqueIds = new Set<number>();
  for (const list of Object.values(out)) {
    for (const r of list) uniqueIds.add(r.account_id);
  }
  if (uniqueIds.size > 0) {
    const clansByAccount = await getPlayerClansBatch(region, [...uniqueIds]);
    for (const list of Object.values(out)) {
      for (const r of list) {
        const clan = clansByAccount.get(r.account_id);
        if (clan) {
          r.clan_tag = clan.tag;
          r.clan_color = clan.color;
        }
      }
    }
  }

  return {
    [RatingMetric.Wn7]: out[RatingMetric.Wn7].slice(0, limit),
    [RatingMetric.Wn8]: out[RatingMetric.Wn8].slice(0, limit),
    [RatingMetric.Wnx]: out[RatingMetric.Wnx].slice(0, limit),
  };
}

export type TopPlayersSnapshot = {
  results: TopPlayerResult[];
  computedAt: Date | null;
};

export async function getTopPlayersByMetric(
  region: Region,
  metric: string,
  period: TopPlayersPeriod,
  limit: number,
): Promise<TopPlayersSnapshot> {
  const topPlayers = topPlayersByRegion[region];
  const rows = await db
    .select()
    .from(topPlayers)
    .where(
      and(eq(topPlayers.metric, metric), eq(topPlayers.period, period)),
    )
    .orderBy(asc(topPlayers.rank))
    .limit(limit);

  return {
    results: rows.map((r) => ({
      account_id: r.accountId,
      nickname: r.nickname,
      clan_tag: r.clanTag,
      clan_color: r.clanColor,
      battles: r.battles,
      wnx: Number(r.value),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export async function getTopPlayersByMetricByRegions(
  regions: Region[],
  metric: string,
  period: TopPlayersPeriod,
  limit: number,
): Promise<Record<Region, TopPlayersSnapshot>> {
  const perRegion = await Promise.all(
    regions.map(
      async (region) =>
        [
          region,
          await getTopPlayersByMetric(region, metric, period, limit),
        ] as const,
    ),
  );
  const out = {} as Record<Region, TopPlayersSnapshot>;
  for (const [region, snap] of perRegion) out[region] = snap;
  return out;
}
