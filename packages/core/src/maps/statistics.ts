import { sql } from "drizzle-orm";
import {
  battlesByRegion,
  buildTankSlugIndex,
  LOADOUT_MODES,
  LOADOUT_WINDOW_DAYS,
  type LoadoutMode,
  loadoutModeOf,
  type MapFinishCount,
  MapFinishReason,
  mapFinishReasonOf,
  type MapGroupStats,
  type MapRecordBaseline,
  type MapRecordStats,
  type MapStatistics,
  type MapTankStats,
  vehiclesByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { getMapStatisticsBaseline } from "@unicum.gg/core/maps/statistics-baseline";
import {
  battleTypesOf,
  RECORD_COLUMNS,
  recordsCte,
  totalsOf,
  type RecordRow,
  type RecordTotals,
} from "@unicum.gg/core/maps/statistics-sql";
import { ratingContext, ratingsOf } from "@unicum.gg/core/tanks/loadout-sql";

/**
 * What the recorded battles say about one map, in one mode (see
 * `MapStatistics` for what is counted and why).
 *
 * `arenas` is the map and every variant folded into it: the Waffenträger
 * reskin and the Onslaught night version are views of the map rather than maps
 * beside it, and they already share its page, its rating and its videos. They
 * are told apart by mode anyway, which is the split every figure here keeps.
 *
 * Three reads, none of which grows with anything but this map's own battles,
 * plus the every-map baseline, which is cached per region.
 */

type BattleRow = {
  battle_type: number;
  finish_reason: number | null;
  winner_team: number | null;
  battles: string | number;
  duration_sum: string | number | null;
  duration_count: string | number;
  newest: string | Date | null;
};

type GroupRow = RecordRow & {
  g_tank: number;
  g_type: number;
  g_tier: number;
  tank_id: number | null;
  type: string | null;
  tier: number | null;
};

const rate = (part: number, whole: number) => (whole > 0 ? part / whole : null);

function statsOf(totals: RecordTotals): MapRecordStats {
  const per = (value: number) => rate(value, totals.records);
  return {
    players: totals.players,
    records: totals.records,
    winrate: per(totals.wins),
    avgDamage: per(totals.damage),
    avgAssist: per(totals.assisted),
    avgKills: per(totals.kills),
    avgSpotted: per(totals.spotted),
    survival: per(totals.survived),
    avgXp: per(totals.xp),
  };
}

/**
 * The same vehicles over every map, each weighted by its records HERE.
 *
 * Weighting by the map's own mix is the whole point: a class average taken over
 * every map would compare this map's tier X heavies against the tier VI ones
 * played elsewhere, and the difference would be about the matchmaker.
 */
function baselineOf(
  tanks: { tankId: number; records: number }[],
  everywhere: Map<number, RecordTotals> | undefined,
): MapRecordBaseline {
  const keys = [
    "wins",
    "damage",
    "assisted",
    "kills",
    "spotted",
    "survived",
    "xp",
  ] as const;
  const sums = Object.fromEntries(keys.map((key) => [key, 0])) as Record<
    (typeof keys)[number],
    number
  >;
  let weight = 0;
  for (const { tankId, records } of tanks) {
    const all = everywhere?.get(tankId);
    if (!all || all.records === 0) continue;
    weight += records;
    for (const key of keys) sums[key] += (records * all[key]) / all.records;
  }
  const per = (key: (typeof keys)[number]) => rate(sums[key], weight);
  return {
    winrate: per("wins"),
    avgDamage: per("damage"),
    avgAssist: per("assisted"),
    avgKills: per("kills"),
    avgSpotted: per("spotted"),
    survival: per("survived"),
    avgXp: per("xp"),
  };
}

export async function getMapStatistics(
  region: Region,
  arenaId: string,
  arenas: string[],
  mode: LoadoutMode,
): Promise<MapStatistics> {
  const battles = battlesByRegion[region];
  const vehicles = vehiclesByRegion[region];
  const onMap = sql.join(
    arenas.map((arena) => sql`${arena}`),
    sql`, `,
  );

  const [battleRows, groupRows, baseline] = await Promise.all([
    // Every counted mode at once: the mode switch needs each one's sample, and
    // the per-battle figures of the mode asked for come out of the same rows.
    db.execute(sql`
      SELECT battle_type, finish_reason, winner_team,
             COUNT(*) AS battles,
             SUM(duration) FILTER (WHERE duration > 0) AS duration_sum,
             COUNT(*) FILTER (WHERE duration > 0) AS duration_count,
             MAX(started_at) AS newest
      FROM ${battles}
      WHERE map_name IN (${onMap})
        AND battle_type IN (${battleTypesOf(null)})
        AND started_at >= now() - make_interval(days => ${LOADOUT_WINDOW_DAYS})
      GROUP BY battle_type, finish_reason, winner_team
    `) as unknown as Promise<BattleRow[]>,
    // One pass for the vehicles, the classes, the tiers and the whole map, so
    // each carries its own distinct player count rather than a sum that would
    // count a player once per vehicle they brought.
    db.execute(sql`
      WITH r AS (${recordsCte(region, arenas, mode)}),
      t AS (
        SELECT r.*, v.type, v.tier
        FROM r LEFT JOIN ${vehicles} v ON v.tank_id = r.tank_id
      )
      SELECT GROUPING(tank_id) AS g_tank, GROUPING(type) AS g_type,
             GROUPING(tier) AS g_tier, tank_id, type, tier, ${RECORD_COLUMNS}
      FROM t
      GROUP BY GROUPING SETS ((tank_id, type, tier), (type), (tier), ())
    `) as unknown as Promise<GroupRow[]>,
    getMapStatisticsBaseline(region),
  ]);

  const modeBattles = new Map<LoadoutMode, number>();
  const finish = new Map<MapFinishReason, number>();
  const spawns = { team1: 0, team2: 0, draws: 0 };
  let durationSum = 0;
  let durationCount = 0;
  let updatedAt: Date | null = null;
  for (const row of battleRows) {
    const rowMode = loadoutModeOf(Number(row.battle_type));
    if (!rowMode) continue;
    const count = Number(row.battles);
    modeBattles.set(rowMode, (modeBattles.get(rowMode) ?? 0) + count);
    if (rowMode !== mode) continue;
    const reason = mapFinishReasonOf(row.finish_reason);
    finish.set(reason, (finish.get(reason) ?? 0) + count);
    if (row.winner_team === 1) spawns.team1 += count;
    else if (row.winner_team === 2) spawns.team2 += count;
    else if (row.winner_team === 0) spawns.draws += count;
    durationSum += Number(row.duration_sum ?? 0);
    durationCount += Number(row.duration_count);
    if (row.newest) {
      const newest = new Date(row.newest);
      if (!updatedAt || newest > updatedAt) updatedAt = newest;
    }
  }

  const everywhere = baseline.get(mode);
  const tankRows = groupRows.filter((row) => row.g_tank === 0);
  const tankRecords = tankRows.map((row) => ({
    tankId: Number(row.tank_id),
    type: row.type,
    tier: row.tier == null ? null : Number(row.tier),
    records: Number(row.records),
  }));
  const total = groupRows.find(
    (row) => row.g_tank === 1 && row.g_type === 1 && row.g_tier === 1,
  );

  // The ratings need a vehicle's tier and expected values, loaded once (they
  // are memoized for the day) and narrowed per vehicle below.
  const context = await ratingContext(region, tankRecords[0]?.tankId ?? 0);
  const ratingTotals = (totals: RecordTotals) => ({
    battles: totals.records,
    wins: totals.wins,
    damage: totals.damage,
    assisted: totals.assisted,
    kills: totals.kills,
    spotted: totals.spotted,
    defended: totals.defended,
  });

  const slugs = buildTankSlugIndex(context.encyclopedia).idToSlug;
  const tanks: MapTankStats[] = tankRows.map((row) => {
    const tankId = Number(row.tank_id);
    const meta = context.encyclopedia[String(tankId)];
    const totals = totalsOf(row);
    const forTank = {
      ...context,
      tankId,
      tier: meta?.tier ?? null,
    };
    const all = everywhere?.get(tankId);
    return {
      tankId,
      vehicle: meta
        ? {
            slug: slugs.get(tankId) ?? null,
            name: meta.name,
            shortName: meta.shortName,
            tag: meta.tag,
            type: meta.type,
            tier: meta.tier,
            nation: meta.nation,
            role: meta.role,
            isPremium: meta.isPremium,
            isReward: meta.isReward,
          }
        : null,
      stats: statsOf(totals),
      rating: ratingsOf(forTank, ratingTotals(totals)),
      baselineRating: ratingsOf(
        forTank,
        all ? ratingTotals(all) : ratingTotals({ ...totals, records: 0 }),
      ),
    };
  });

  // A vehicle the catalogue table does not know yet falls out of the class
  // and tier rows (it has neither) while still counting on the map's totals.
  const group = (
    pick: (row: GroupRow) => boolean,
    keyOf: (row: GroupRow) => string,
    member: (tank: (typeof tankRecords)[number], key: string) => boolean,
  ): MapGroupStats[] =>
    groupRows.filter(pick).map((row) => {
      const key = keyOf(row);
      return {
        key,
        stats: statsOf(totalsOf(row)),
        baseline: baselineOf(
          tankRecords.filter((tank) => member(tank, key)),
          everywhere,
        ),
      };
    });

  const classes = group(
    (row) => row.g_tank === 1 && row.g_type === 0 && row.type != null,
    (row) => row.type!,
    (tank, key) => tank.type === key,
  );
  const tiers = group(
    (row) => row.g_tank === 1 && row.g_tier === 0 && row.tier != null,
    (row) => String(row.tier),
    (tank, key) => String(tank.tier) === key,
  ).sort((a, b) => Number(a.key) - Number(b.key));

  const finishCounts: MapFinishCount[] = Object.values(MapFinishReason)
    .map((reason) => ({ reason, battles: finish.get(reason) ?? 0 }))
    .filter((entry) => entry.battles > 0);

  const totals = total ? totalsOf(total) : null;
  return {
    arenaId,
    mode,
    modes: LOADOUT_MODES.map((each) => ({
      mode: each,
      battles: modeBattles.get(each) ?? 0,
    })),
    battles: modeBattles.get(mode) ?? 0,
    players: totals?.players ?? 0,
    records: totals?.records ?? 0,
    avgDuration: rate(durationSum, durationCount),
    finish: finishCounts,
    spawns,
    classes,
    tiers,
    tanks,
    updatedAt,
  };
}
