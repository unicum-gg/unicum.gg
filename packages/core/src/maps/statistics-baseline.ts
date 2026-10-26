import { sql } from "drizzle-orm";
import { type LoadoutMode, loadoutModeOf } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { createRegionCache } from "@unicum.gg/core/lib/region-cache";
import {
  RECORD_COLUMNS,
  recordsCte,
  totalsOf,
  type RecordRow,
  type RecordTotals,
} from "@unicum.gg/core/maps/statistics-sql";

/**
 * Every vehicle's totals over every map, per mode: what a map's figures are
 * read against.
 *
 * The same for every map of a region, so it is computed once per region and
 * held for an hour rather than per page view: it unnests every battle of the
 * window, which is nothing today and would be the most expensive read on the
 * map page once the mod has a few months of uploads behind it. An hour is far
 * inside how fast a ninety-day average moves.
 */
export type MapStatisticsBaseline = Map<LoadoutMode, Map<number, RecordTotals>>;

type BaselineRow = RecordRow & {
  battle_type: number;
  tank_id: number;
};

async function loadBaseline(region: Region): Promise<MapStatisticsBaseline> {
  const rows = (await db.execute(sql`
    WITH r AS (${recordsCte(region, null, null)})
    SELECT battle_type, tank_id, ${RECORD_COLUMNS}
    FROM r
    GROUP BY battle_type, tank_id
  `)) as unknown as BaselineRow[];

  // Folded in TypeScript because a mode can span several `bonusType` values,
  // and the mapping between the two lives in shared rather than in SQL.
  const baseline: MapStatisticsBaseline = new Map();
  for (const row of rows) {
    const mode = loadoutModeOf(Number(row.battle_type));
    if (!mode) continue;
    const byTank = baseline.get(mode) ?? new Map<number, RecordTotals>();
    baseline.set(mode, byTank);
    const tankId = Number(row.tank_id);
    const totals = totalsOf(row);
    const held = byTank.get(tankId);
    byTank.set(
      tankId,
      held
        ? {
            // Players do not add across two `bonusType`s of one mode, but
            // nothing reads the baseline's player count.
            players: held.players + totals.players,
            records: held.records + totals.records,
            wins: held.wins + totals.wins,
            damage: held.damage + totals.damage,
            assisted: held.assisted + totals.assisted,
            kills: held.kills + totals.kills,
            spotted: held.spotted + totals.spotted,
            defended: held.defended + totals.defended,
            survived: held.survived + totals.survived,
            xp: held.xp + totals.xp,
          }
        : totals,
    );
  }
  return baseline;
}

const baselineCache = createRegionCache(loadBaseline, 60 * 60 * 1000);

export function getMapStatisticsBaseline(
  region: Region,
): Promise<MapStatisticsBaseline> {
  return baselineCache.get(region);
}
