import { sql, type SQL } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  SKIRMISH_TIERS,
  TankBattleMode,
  playerSkirmishTiersByRegion,
  playersByRegion,
  tankModesByRegion,
  vehiclesByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

/** The tier a Skirmish battle is filed under: the vehicle's own when it is one
 * Skirmishes are fought at, 0 for every other (the formats that came before),
 * including a vehicle the catalogue does not hold. */
export function skirmishTierKey(region: Region): SQL {
  const vehicles = vehiclesByRegion[region];
  const tiers = sql.raw(SKIRMISH_TIERS.join(","));
  return sql`CASE WHEN ${vehicles.tier} IN (${tiers}) THEN ${vehicles.tier} ELSE 0 END`;
}

/**
 * Record the per-tier Skirmish totals of these players where they moved.
 *
 * Read back from `*_tank_modes` rather than folded from the fetch in hand, so
 * the history, the seed and the lifetime figure on the page are one definition
 * of how vehicles become tiers. A row is written only for a tier whose battle
 * count differs from its newest row, which is what keeps the table to the
 * refreshes that saw a player actually fight one.
 *
 * Returns how many rows it wrote.
 */
export async function recordSkirmishTierHistory(
  region: Region,
  playerIds: number[],
): Promise<number> {
  if (playerIds.length === 0) return 0;
  const modes = tankModesByRegion[region];
  const vehicles = vehiclesByRegion[region];
  const history = playerSkirmishTiersByRegion[region];
  const ids = sql.raw(playerIds.map((id) => Math.trunc(id)).join(","));

  const result = await db.execute(sql`
    WITH current AS (
      SELECT
        ${modes.playerId} AS player_id,
        ${skirmishTierKey(region)} AS tier,
        SUM(${modes.battles})::int AS battles,
        SUM(${modes.wins})::int AS wins,
        SUM(${modes.losses})::int AS losses,
        SUM(${modes.draws})::int AS draws,
        SUM(${modes.survivedBattles})::int AS survived_battles,
        SUM(${modes.frags})::int AS frags,
        SUM(${modes.damageDealt})::bigint AS damage_dealt,
        SUM(${modes.spotted})::int AS spotted,
        SUM(${modes.capturePoints})::int AS capture_points,
        SUM(${modes.droppedCapturePoints})::int AS dropped_capture_points,
        SUM(${modes.xp})::bigint AS xp
      FROM ${modes}
      LEFT JOIN ${vehicles} ON ${vehicles.tankId} = ${modes.tankId}
      WHERE ${modes.playerId} IN (${ids})
        AND ${modes.mode} = ${TankBattleMode.Skirmish}
      GROUP BY 1, 2
      HAVING SUM(${modes.battles}) > 0
    )
    INSERT INTO ${history} (
      player_id, tier, taken_at, battles, wins, losses, draws,
      survived_battles, frags, damage_dealt, spotted, capture_points,
      dropped_capture_points, xp
    )
    SELECT
      c.player_id, c.tier, now(), c.battles, c.wins, c.losses, c.draws,
      c.survived_battles, c.frags, c.damage_dealt, c.spotted, c.capture_points,
      c.dropped_capture_points, c.xp
    FROM current c
    LEFT JOIN LATERAL (
      SELECT h.battles
      FROM ${history} h
      WHERE h.player_id = c.player_id AND h.tier = c.tier
      ORDER BY h.taken_at DESC
      LIMIT 1
    ) last ON true
    WHERE last.battles IS DISTINCT FROM c.battles
    ON CONFLICT DO NOTHING
  `);
  return result.count ?? 0;
}

const SEED_BATCH = 2000;

/**
 * Write every player's first history rows from the current breakdown.
 *
 * The history cannot reach back past its first row, so without this a window
 * starts filling only on each player's next skirmish; with it, every window is
 * complete once its own length has passed since the seed. Walks `*_players` by
 * id, so it is resumable from the printed cursor, and re-running is harmless:
 * a tier already recorded at the same total writes nothing.
 */
export async function seedSkirmishTierHistory(
  region: Region,
  options: {
    from?: number;
    limit?: number;
    onProgress?: (p: { cursor: number; examined: number; written: number }) => void;
  } = {},
): Promise<{ cursor: number; examined: number; written: number }> {
  const players = playersByRegion[region];
  let cursor = options.from ?? 0;
  let examined = 0;
  let written = 0;
  for (;;) {
    const left =
      options.limit === undefined ? SEED_BATCH : Math.min(SEED_BATCH, options.limit - examined);
    if (left <= 0) break;
    const rows = await db
      .select({ id: players.id })
      .from(players)
      .where(sql`${players.id} > ${cursor}`)
      .orderBy(players.id)
      .limit(left);
    if (rows.length === 0) break;
    const ids = rows.map((r) => r.id);
    written += await recordSkirmishTierHistory(region, ids);
    examined += ids.length;
    cursor = ids[ids.length - 1];
    options.onProgress?.({ cursor, examined, written });
  }
  return { cursor, examined, written };
}
