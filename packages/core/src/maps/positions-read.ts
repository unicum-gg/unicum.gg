import { sql } from "drizzle-orm";
import {
  battleHitsByRegion,
  battleSpotsByRegion,
  DAMAGE_GRID,
  GUIDE_PHASE_ENDS,
  LOADOUT_WINDOW_DAYS,
  loadoutModeOf,
  type MapPositionLayout,
  type MapPositions,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import { db } from "@unicum.gg/core/db";
import { battleTypesOf } from "@unicum.gg/core/maps/statistics-sql";

type LayoutCols = { map_name: string; gameplay_id: string; battle_type: number };

type SpotRow = LayoutCols & {
  team: number;
  vehicle_class: string;
  left: number;
  top: number;
  settled_at: number;
  damage: number;
  kills: number;
  survived: boolean;
  won: boolean;
};

type DamageRow = LayoutCols & {
  team: number;
  vehicle_class: string;
  phase: number;
  cells: number[];
  damage: (number | string)[];
};

type KillRow = LayoutCols & {
  team: number;
  vehicle_class: string;
  left: number;
  top: number;
  at: number;
};

type BattlesRow = LayoutCols & { battles: string | number };

/**
 * Where a map's players set up and dealt damage from, over the statistics'
 * own window, in every counted mode, grouped by the layout each was played on.
 *
 * The spots and the killing shots go out as points, a few hundred at most on
 * the busiest map, so the minimap can filter by side and class without asking
 * again. The damage is summed into a grid in Postgres, since a map's shots run
 * to thousands and only their total per place is ever drawn.
 */
export async function getMapPositions(
  region: Region,
  arenaId: string,
  arenas: string[],
): Promise<MapPositions> {
  const spots = battleSpotsByRegion[region];
  const hits = battleHitsByRegion[region];
  const scope = sql`
    map_name IN (${sql.join(
      arenas.map((arena) => sql`${arena}`),
      sql`, `,
    )})
    AND battle_type IN (${battleTypesOf(null)})
    AND started_at >= now() - make_interval(days => ${LOADOUT_WINDOW_DAYS})
  `;

  const [spotRows, damageRows, killRows, battleRows] = await Promise.all([
    db.execute(sql`
      SELECT map_name, gameplay_id, battle_type, team, vehicle_class,
             "left", top, settled_at, damage, kills, survived, won
      FROM ${spots} WHERE ${scope}
    `) as unknown as Promise<SpotRow[]>,
    db.execute(sql`
      WITH c AS (
        SELECT map_name, gameplay_id, battle_type, team, vehicle_class,
               CASE WHEN at < ${GUIDE_PHASE_ENDS[0]} THEN 0
                    WHEN at < ${GUIDE_PHASE_ENDS[1]} THEN 1 ELSE 2 END AS phase,
               LEAST(${DAMAGE_GRID - 1}, floor(top / 100 * ${DAMAGE_GRID}))::int * ${DAMAGE_GRID}
                 + LEAST(${DAMAGE_GRID - 1}, floor("left" / 100 * ${DAMAGE_GRID}))::int AS cell,
               SUM(damage) AS total
        FROM ${hits} WHERE ${scope}
        GROUP BY 1, 2, 3, 4, 5, 6, 7
      )
      SELECT map_name, gameplay_id, battle_type, team, vehicle_class, phase,
             array_agg(cell ORDER BY cell) AS cells,
             array_agg(total ORDER BY cell) AS damage
      FROM c GROUP BY 1, 2, 3, 4, 5, 6
    `) as unknown as Promise<DamageRow[]>,
    db.execute(sql`
      SELECT map_name, gameplay_id, battle_type, team, vehicle_class,
             "left", top, at
      FROM ${hits} WHERE ${scope} AND fatal
    `) as unknown as Promise<KillRow[]>,
    db.execute(sql`
      SELECT map_name, gameplay_id, battle_type,
             COUNT(DISTINCT arena_unique_id) AS battles
      FROM (
        SELECT arena_unique_id, map_name, gameplay_id, battle_type
        FROM ${spots} WHERE ${scope}
        UNION
        SELECT arena_unique_id, map_name, gameplay_id, battle_type
        FROM ${hits} WHERE ${scope}
      ) b
      GROUP BY 1, 2, 3
    `) as unknown as Promise<BattlesRow[]>,
  ]);

  // Battle types fold into modes, so one layout can gather several of them.
  const layouts = new Map<string, MapPositionLayout>();
  const layoutOf = (row: LayoutCols) => {
    const mode = loadoutModeOf(Number(row.battle_type));
    if (!mode) return null;
    const key = `${row.map_name}/${row.gameplay_id}/${mode}`;
    let layout = layouts.get(key);
    if (!layout) {
      layout = {
        arenaId: row.map_name,
        gameplayId: row.gameplay_id,
        mode,
        battles: 0,
        spots: [],
        damage: [],
        kills: [],
      };
      layouts.set(key, layout);
    }
    return layout;
  };

  for (const row of battleRows) {
    const layout = layoutOf(row);
    if (layout) layout.battles += Number(row.battles);
  }
  for (const row of spotRows) {
    layoutOf(row)?.spots.push({
      team: Number(row.team),
      vehicleClass: row.vehicle_class,
      left: Number(row.left),
      top: Number(row.top),
      settledAt: Math.round(Number(row.settled_at)),
      damage: Number(row.damage),
      kills: Number(row.kills),
      survived: Boolean(row.survived),
      won: Boolean(row.won),
    });
  }
  for (const row of damageRows) {
    const layout = layoutOf(row);
    if (!layout) continue;
    // Two battle types of one mode land in the same layout, so their slices
    // for the same side and class are added rather than listed twice.
    let slice = layout.damage.find(
      (each) =>
        each.team === Number(row.team) &&
        each.vehicleClass === row.vehicle_class &&
        each.phase === Number(row.phase),
    );
    if (!slice) {
      slice = {
        team: Number(row.team),
        vehicleClass: row.vehicle_class,
        phase: Number(row.phase),
        cells: [],
        damage: [],
      };
      layout.damage.push(slice);
    }
    row.cells.forEach((cell, index) => {
      slice.cells.push(Number(cell));
      slice.damage.push(Number(row.damage[index]));
    });
  }
  for (const row of killRows) {
    layoutOf(row)?.kills.push({
      team: Number(row.team),
      vehicleClass: row.vehicle_class,
      left: Number(row.left),
      top: Number(row.top),
      at: Math.round(Number(row.at)),
    });
  }

  return {
    arenaId,
    grid: DAMAGE_GRID,
    layouts: [...layouts.values()].sort((a, b) => b.battles - a.battles),
  };
}
