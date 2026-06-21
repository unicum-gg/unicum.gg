import { eq, sql } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type TankAggregate,
  tankAggregatesByRegion,
  tankSnapshotsByRegion,
} from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";

export type TankCommunityStats = {
  tankId: number;
  players: number;
  battles: number;
  avgWinrate: number | null;
  avgDamage: number | null;
  avgFrags: number | null;
  computedAt: Date;
};

function toCommunityStats(row: TankAggregate): TankCommunityStats {
  return {
    tankId: row.tankId,
    players: row.players,
    battles: row.battles,
    avgWinrate: row.battles > 0 ? row.wins / row.battles : null,
    avgDamage: row.battles > 0 ? row.damageDealt / row.battles : null,
    avgFrags: row.battles > 0 ? row.frags / row.battles : null,
    computedAt: row.computedAt,
  };
}

export async function getTankCommunityStats(
  region: Region,
  tankId: number,
): Promise<TankCommunityStats | null> {
  const table = tankAggregatesByRegion[region];
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.tankId, tankId))
    .limit(1);
  const row = rows[0];
  return row ? toCommunityStats(row) : null;
}

export async function listTankCommunityStats(
  region: Region,
): Promise<Map<number, TankCommunityStats>> {
  const table = tankAggregatesByRegion[region];
  const rows = await db.select().from(table);
  const out = new Map<number, TankCommunityStats>();
  for (const row of rows) out.set(row.tankId, toCommunityStats(row));
  return out;
}

/**
 * Roll up every tracked player's latest per-tank snapshot into the per-region
 * aggregate table. This is the one heavy query in the tank feature: it sorts
 * the whole <region>_tank_snapshots table to take the latest row per
 * (player, tank), then groups by tank. It is meant to run once nightly off a
 * cron, never on the request path. We intentionally do NOT add a covering
 * index for it: that index would sit on a multi-million-row, hot-write table
 * and tax every snapshot insert, which is the opposite of the margin goal. A
 * once-a-day external sort is the cheaper trade.
 *
 * Upsert (not delete+insert) so a tank that drops out of the latest set keeps
 * its last known totals rather than vanishing from the index mid-day.
 */
export async function recomputeTankAggregates(region: Region): Promise<number> {
  const agg = tankAggregatesByRegion[region];
  const snaps = tankSnapshotsByRegion[region];
  const result = await db.execute<{ tank_id: number }>(sql`
    INSERT INTO ${agg} (
      tank_id, players, battles, wins, damage_dealt, frags, spotted, computed_at
    )
    SELECT
      tank_id,
      COUNT(*)::int AS players,
      SUM(battles) AS battles,
      SUM(wins) AS wins,
      SUM(damage_dealt) AS damage_dealt,
      SUM(frags) AS frags,
      SUM(spotted) AS spotted,
      now() AS computed_at
    FROM (
      SELECT DISTINCT ON (player_id, tank_id)
        tank_id, battles, wins, damage_dealt, frags, spotted
      FROM ${snaps}
      ORDER BY player_id, tank_id, taken_at DESC, id DESC
    ) latest
    GROUP BY tank_id
    ON CONFLICT (tank_id) DO UPDATE SET
      players = EXCLUDED.players,
      battles = EXCLUDED.battles,
      wins = EXCLUDED.wins,
      damage_dealt = EXCLUDED.damage_dealt,
      frags = EXCLUDED.frags,
      spotted = EXCLUDED.spotted,
      computed_at = EXCLUDED.computed_at
    RETURNING tank_id
  `);
  return Array.isArray(result) ? result.length : 0;
}
