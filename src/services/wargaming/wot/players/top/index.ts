import { and, asc, eq, sql } from "drizzle-orm";
import { RatingMetric } from "@/constants/rating";
import { db } from "@/services/db";
import {
  playerSnapshotsByRegion,
  playersByRegion,
  tankSnapshotsByRegion,
  topPlayersByRegion,
} from "@/services/db/schema";
import { getPlayerClansBatch } from "@/services/wargaming/wot/clans/listings";
import {
  computeAvgTier,
  getVehicleEncyclopedia,
} from "@/services/wargaming/wot/encyclopedia";
import { type Region } from "@/services/wargaming/wot";
import {
  buildWN8Fallback,
  computeWN7,
  computeWN8,
  computeWNX,
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

export enum TopPlayersPeriod {
  Day = "24h",
  Week = "7d",
  Overall = "overall",
}

const PERIOD_INTERVAL: Record<TopPlayersPeriod, string | null> = {
  [TopPlayersPeriod.Day]: "24 hours",
  [TopPlayersPeriod.Week]: "7 days",
  [TopPlayersPeriod.Overall]: null,
};

const MIN_BATTLES: Record<TopPlayersPeriod, number> = {
  [TopPlayersPeriod.Day]: 20,
  [TopPlayersPeriod.Week]: 140,
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

type DiffRow = {
  account_id: number;
  nickname: string;
  tank_id: number;
  diff_battles: string | number;
  diff_wins: string | number;
  diff_damage: string | number;
  diff_spotted: string | number;
  diff_frags: string | number;
  diff_dropped_cap: string | number;
  diff_assist: string | number;
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

  const players = playersByRegion[region];
  const tankSnapshots = tankSnapshotsByRegion[region];
  const interval = PERIOD_INTERVAL[period];
  const minBattles = MIN_BATTLES[period];

  const rows = (await db.execute(
    interval === null
      ? sql`
        SELECT
          p.account_id, p.nickname, ts.tank_id,
          ts.battles AS diff_battles,
          ts.wins AS diff_wins,
          ts.damage_dealt AS diff_damage,
          ts.spotted AS diff_spotted,
          ts.frags AS diff_frags,
          ts.dropped_capture_points AS diff_dropped_cap,
          (ts.radio_assisted_damage + ts.track_assisted_damage) AS diff_assist
        FROM (
          SELECT DISTINCT ON (player_id, tank_id)
            player_id, tank_id, battles, wins, damage_dealt, spotted, frags,
            dropped_capture_points, radio_assisted_damage, track_assisted_damage
          FROM ${tankSnapshots}
          ORDER BY player_id, tank_id, taken_at DESC
        ) ts
        INNER JOIN ${players} p ON p.id = ts.player_id
      `
      : sql`
        WITH latest AS (
          SELECT DISTINCT ON (player_id, tank_id)
            player_id, tank_id, battles, wins, damage_dealt, spotted, frags,
            dropped_capture_points, radio_assisted_damage, track_assisted_damage
          FROM ${tankSnapshots}
          ORDER BY player_id, tank_id, taken_at DESC
        ),
        earlier AS (
          SELECT DISTINCT ON (player_id, tank_id)
            player_id, tank_id, battles, wins, damage_dealt, spotted, frags,
            dropped_capture_points, radio_assisted_damage, track_assisted_damage
          FROM ${tankSnapshots}
          WHERE taken_at <= NOW() - ${sql.raw(`INTERVAL '${interval}'`)}
          ORDER BY player_id, tank_id, taken_at DESC
        )
        SELECT
          p.account_id, p.nickname, l.tank_id,
          (l.battles - e.battles) AS diff_battles,
          (l.wins - e.wins) AS diff_wins,
          (l.damage_dealt - e.damage_dealt) AS diff_damage,
          (l.spotted - e.spotted) AS diff_spotted,
          (l.frags - e.frags) AS diff_frags,
          (l.dropped_capture_points - e.dropped_capture_points) AS diff_dropped_cap,
          ((l.radio_assisted_damage - e.radio_assisted_damage) + (l.track_assisted_damage - e.track_assisted_damage)) AS diff_assist
        FROM latest l
        INNER JOIN earlier e USING (player_id, tank_id)
        INNER JOIN ${players} p ON p.id = l.player_id
        WHERE l.battles > e.battles
      `,
  )) as unknown as DiffRow[];

  type Agg = {
    account_id: number;
    nickname: string;
    tanks: TankStats[];
    totalBattles: number;
    totalWins: number;
    totalFrags: number;
    totalDamage: number;
    totalSpotted: number;
    totalDroppedCap: number;
  };
  const byPlayer = new Map<number, Agg>();
  for (const row of rows) {
    const battles = Number(row.diff_battles);
    if (battles <= 0) continue;
    const accountId = Number(row.account_id);
    const wins = Number(row.diff_wins);
    const damage = Number(row.diff_damage);
    const spotted = Number(row.diff_spotted);
    const frags = Number(row.diff_frags);
    const droppedCap = Number(row.diff_dropped_cap);
    let agg = byPlayer.get(accountId);
    if (!agg) {
      agg = {
        account_id: accountId,
        nickname: row.nickname,
        tanks: [],
        totalBattles: 0,
        totalWins: 0,
        totalFrags: 0,
        totalDamage: 0,
        totalSpotted: 0,
        totalDroppedCap: 0,
      };
      byPlayer.set(accountId, agg);
    }
    agg.tanks.push({
      tank_id: Number(row.tank_id),
      all: {
        battles,
        wins,
        damage_dealt: damage,
        spotted,
        frags,
        dropped_capture_points: droppedCap,
        radio_assisted_damage: Number(row.diff_assist),
        track_assisted_damage: 0,
      },
    });
    agg.totalBattles += battles;
    agg.totalWins += wins;
    agg.totalFrags += frags;
    agg.totalDamage += damage;
    agg.totalSpotted += spotted;
    agg.totalDroppedCap += droppedCap;
  }

  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);

  type Scored = {
    base: Omit<TopPlayerResult, "wnx">;
    wn7: number | null;
    wn8: number | null;
    wnx: number | null;
  };
  const scored: Scored[] = [];
  for (const agg of byPlayer.values()) {
    if (agg.totalBattles < minBattles) continue;
    const wnx = computeWNX(agg.tanks, wnxExpected);
    const wn8 = computeWN8(agg.tanks, wn8Expected, encyclopedia, wn8Fallback);
    const avgTier = computeAvgTier(agg.tanks, encyclopedia);
    const wn7 = computeWN7(
      {
        battles: agg.totalBattles,
        wins: agg.totalWins,
        frags: agg.totalFrags,
        damageDealt: agg.totalDamage,
        spotted: agg.totalSpotted,
        droppedCapturePoints: agg.totalDroppedCap,
      },
      avgTier,
    );
    scored.push({
      base: {
        account_id: agg.account_id,
        nickname: agg.nickname,
        clan_tag: null,
        clan_color: null,
        battles: agg.totalBattles,
      },
      wn7: wn7 != null && Number.isFinite(wn7) ? wn7 : null,
      wn8: Number.isFinite(wn8) ? wn8 : null,
      wnx: wnx != null && Number.isFinite(wnx) ? wnx : null,
    });
  }

  function topByScore(field: "wn7" | "wn8" | "wnx"): TopPlayerResult[] {
    return scored
      .filter((s): s is Scored & { [K in typeof field]: number } => s[field] !== null)
      .sort((a, b) => b[field] - a[field])
      .slice(0, ENRICH_CANDIDATES)
      .map((s) => ({ ...s.base, wnx: s[field] }));
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
 * Overall ranking fast path: the players row already holds wn7/wn8/wnx
 * (recomputed on every snapshot-cron tick), so we just need each player's
 * lifetime battle count (from the latest player_snapshot) to apply the
 * 20k minimum and ORDER BY the cached column. No tank-snapshot scan, no
 * per-player WN compute. Done in one round-trip per metric, plus one
 * clan-enrichment batch over the union.
 */
async function computeOverallFromCache(
  region: Region,
  limit: number,
): Promise<TopPlayersAllMetrics> {
  const minBattles = MIN_BATTLES[TopPlayersPeriod.Overall];
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];

  type Row = {
    account_id: string | number;
    nickname: string;
    battles: number;
    value: string | number;
  };
  const fetchTop = async (
    column: "wn7" | "wn8" | "wnx",
  ): Promise<TopPlayerResult[]> => {
    const metricCol = sql.raw(`p."${column}"`);
    const rows = (await db.execute(sql`
      WITH latest_snap AS (
        SELECT DISTINCT ON (player_id) player_id, battles
        FROM ${playerSnapshots}
        ORDER BY player_id, taken_at DESC, id DESC
      )
      SELECT p.account_id, p.nickname, s.battles, ${metricCol} AS value
      FROM latest_snap s
      INNER JOIN ${players} p ON p.id = s.player_id
      WHERE s.battles >= ${minBattles}
        AND ${metricCol} IS NOT NULL
      ORDER BY ${metricCol} DESC
      LIMIT ${ENRICH_CANDIDATES}
    `)) as unknown as Row[];
    return rows.map((r) => ({
      account_id: Number(r.account_id),
      nickname: r.nickname,
      clan_tag: null,
      clan_color: null,
      battles: r.battles,
      wnx: Number(r.value),
    }));
  };

  const [wn7, wn8, wnx] = await Promise.all([
    fetchTop("wn7"),
    fetchTop("wn8"),
    fetchTop("wnx"),
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
