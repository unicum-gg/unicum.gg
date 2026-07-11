import { and, asc, eq } from "drizzle-orm";
import { RATING_METRICS, RatingMetric } from "@unicum.gg/core/constants/rating";
import { db } from "@unicum.gg/core/db";
import {
  tankStatsByRegion,
  topPlayersByTankByRegion,
} from "@unicum.gg/core/db/schema";
import { type Region } from "@unicum.gg/wargaming/region";

export type TopTankPlayer = {
  account_id: number;
  nickname: string;
  clan_tag: string | null;
  clan_color: string | null;
  battles: number;
  avg_damage: number;
  winrate: number;
  value: number;
};

export type TopTankPlayersByMetric = {
  [RatingMetric.Wn7]: TopTankPlayer[];
  [RatingMetric.Wn8]: TopTankPlayer[];
  [RatingMetric.Wnx]: TopTankPlayer[];
  computedAt: Date | null;
};

export async function getTopPlayersByTank(
  region: Region,
  tankId: number,
  metric: string,
  limit: number,
): Promise<{ results: TopTankPlayer[]; computedAt: Date | null }> {
  const table = topPlayersByTankByRegion[region];
  const rows = await db
    .select()
    .from(table)
    .where(and(eq(table.tankId, tankId), eq(table.metric, metric)))
    .orderBy(asc(table.rank))
    .limit(limit);
  return {
    results: rows.map((r) => ({
      account_id: r.accountId,
      nickname: r.nickname,
      clan_tag: r.clanTag,
      clan_color: r.clanColor,
      battles: r.battles,
      avg_damage: r.avgDamage,
      winrate: r.winrate,
      value: Number(r.value),
    })),
    computedAt: rows[0]?.computedAt ?? null,
  };
}

export type TankServerStats = {
  players: number;
  avg_battles: number;
  total_battles: number | null;
  avg_damage: number;
  winrate: number;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  // Extra columns for the /tanks server-average table. Null until the by-tank
  // cron has enough snapshot coverage to compute them.
  player_wr: number | null;
  avg_spots: number | null;
  avg_assist: number | null;
  kdr: number | null;
  hit_pct: number | null;
  pen_pct: number | null;
  avg_blocked: number | null;
  survival: number | null;
  // Cumulative holder counts among tracked players (>= level). Null until the
  // cron recomputes after these columns were added.
  moe1: number | null;
  moe2: number | null;
  moe3: number | null;
  mom_class3: number | null;
  mom_class2: number | null;
  mom_class1: number | null;
  mom_ace: number | null;
};

type TankStatsRow = typeof tankStatsByRegion[Region]["$inferSelect"];

function toTankServerStats(row: TankStatsRow): TankServerStats {
  return {
    players: row.players,
    avg_battles: row.avgBattles,
    total_battles: row.totalBattles,
    avg_damage: row.avgDamage,
    winrate: row.winrate,
    wn7: row.wn7 != null ? Number(row.wn7) : null,
    wn8: row.wn8 != null ? Number(row.wn8) : null,
    wnx: row.wnx != null ? Number(row.wnx) : null,
    player_wr: row.playerWr,
    avg_spots: row.avgSpots,
    avg_assist: row.avgAssist,
    kdr: row.kdr,
    hit_pct: row.hitPct,
    pen_pct: row.penPct,
    avg_blocked: row.avgBlocked,
    survival: row.survival,
    moe1: row.moe1,
    moe2: row.moe2,
    moe3: row.moe3,
    mom_class3: row.momClass3,
    mom_class2: row.momClass2,
    mom_class1: row.momClass1,
    mom_ace: row.momAce,
  };
}

/** Server-wide averages for a tank (the "average player" panel), or null. */
export async function getTankStats(
  region: Region,
  tankId: number,
): Promise<TankServerStats | null> {
  const table = tankStatsByRegion[region];
  const [row] = await db
    .select()
    .from(table)
    .where(eq(table.tankId, tankId))
    .limit(1);
  return row ? toTankServerStats(row) : null;
}

/** Server-wide averages for every tank that has a stats row, keyed by tank id.
 * Powers the /tanks catalogue table. */
export async function getAllTankStats(
  region: Region,
): Promise<Map<number, TankServerStats>> {
  const table = tankStatsByRegion[region];
  const rows = await db.select().from(table);
  return new Map(rows.map((r) => [r.tankId, toTankServerStats(r)]));
}

/** All three metric leaderboards for one tank, for the tank page. */
export async function getTopPlayersByTankAllMetrics(
  region: Region,
  tankId: number,
  limit: number,
): Promise<TopTankPlayersByMetric> {
  const perMetric = await Promise.all(
    RATING_METRICS.map((m) => getTopPlayersByTank(region, tankId, m, limit)),
  );
  const byMetric = new Map(RATING_METRICS.map((m, i) => [m, perMetric[i]]));
  return {
    [RatingMetric.Wn7]: byMetric.get(RatingMetric.Wn7)?.results ?? [],
    [RatingMetric.Wn8]: byMetric.get(RatingMetric.Wn8)?.results ?? [],
    [RatingMetric.Wnx]: byMetric.get(RatingMetric.Wnx)?.results ?? [],
    computedAt: perMetric.find((p) => p.computedAt)?.computedAt ?? null,
  };
}
