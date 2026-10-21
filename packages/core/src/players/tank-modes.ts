import { and, eq, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  TANK_MODES_STORED,
  type NewTankModeRow,
  type TankModeRow,
  type TankModeStatistics,
  type TankStatsWithModes,
  tankModesByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";

const MODE_INSERT_CHUNK = 500;

/**
 * One mode block, as a row.
 *
 * Every counter here is in every block Wargaming answers, so none of them is
 * nullable. The four below them are not: the armour figures come with
 * `fallout`, `globalmap` and the two Stronghold blocks only, and the record
 * scores with every mode but `company` and `globalmap`.
 */
function rowFromBlock(
  playerId: number,
  tankId: number,
  mode: string,
  block: TankModeStatistics,
): NewTankModeRow {
  return {
    playerId,
    tankId,
    mode,
    battles: block.battles,
    wins: block.wins,
    losses: block.losses,
    draws: block.draws,
    survivedBattles: block.survived_battles,
    frags: block.frags,
    damageDealt: block.damage_dealt,
    damageReceived: block.damage_received,
    spotted: block.spotted,
    capturePoints: block.capture_points,
    droppedCapturePoints: block.dropped_capture_points,
    xp: block.xp,
    hits: block.hits,
    shots: block.shots,
    radioAssistedDamage: block.radio_assisted_damage,
    trackAssistedDamage: block.track_assisted_damage,
    stunNumber: block.stun_number,
    stunAssistedDamage: block.stun_assisted_damage,
    piercings: block.piercings ?? null,
    // Wargaming reports the per-battle average; store the total so it sums and
    // diffs like every counter beside it.
    damageBlocked:
      block.avg_damage_blocked == null
        ? null
        : Math.round(block.avg_damage_blocked * block.battles),
    tankingFactor: block.tanking_factor ?? null,
    // 0 is Wargaming saying it reports none for this mode rather than a career
    // without a damaging battle, so it is stored as absent.
    maxDamage: block.max_damage ? block.max_damage : null,
    maxXp: block.max_xp ?? null,
    maxFrags: block.max_frags ?? null,
    updatedAt: new Date(),
  };
}

/**
 * Write one player's per-mode records.
 *
 * Called beside `bulkInsertTankSnapshots` on every path that fetches a player's
 * vehicles, so the breakdown is as fresh as the overall figures it sits under.
 *
 * Current state, so this upserts: see `makeTankModesTable` for why this one
 * table in the family is not a time series.
 *
 * A mode holding no battles is skipped rather than written as zeroes, which is
 * what keeps the table a quarter the size of the vehicle rows rather than
 * eleven times them. It is also what makes a `null` block safe: Wargaming
 * answers null for an `extra` a vehicle was never played in, and a transient
 * null on a mode we HAVE seen leaves the stored row untouched instead of
 * flattening a record to zero.
 */
export async function bulkUpsertTankModes(
  region: Region,
  playerId: number,
  tanks: TankStatsWithModes[],
): Promise<void> {
  const table = tankModesByRegion[region];
  const rows: NewTankModeRow[] = [];
  for (const tank of tanks) {
    for (const mode of TANK_MODES_STORED) {
      const block = tank[mode];
      if (!block || block.battles <= 0) continue;
      rows.push(rowFromBlock(playerId, tank.tank_id, mode, block));
    }
  }
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += MODE_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + MODE_INSERT_CHUNK);
    await db
      .insert(table)
      .values(chunk)
      .onConflictDoUpdate({
        target: [table.playerId, table.tankId, table.mode],
        set: {
          battles: sql`EXCLUDED.battles`,
          wins: sql`EXCLUDED.wins`,
          losses: sql`EXCLUDED.losses`,
          draws: sql`EXCLUDED.draws`,
          survivedBattles: sql`EXCLUDED.survived_battles`,
          frags: sql`EXCLUDED.frags`,
          damageDealt: sql`EXCLUDED.damage_dealt`,
          damageReceived: sql`EXCLUDED.damage_received`,
          spotted: sql`EXCLUDED.spotted`,
          capturePoints: sql`EXCLUDED.capture_points`,
          droppedCapturePoints: sql`EXCLUDED.dropped_capture_points`,
          xp: sql`EXCLUDED.xp`,
          hits: sql`EXCLUDED.hits`,
          shots: sql`EXCLUDED.shots`,
          radioAssistedDamage: sql`EXCLUDED.radio_assisted_damage`,
          trackAssistedDamage: sql`EXCLUDED.track_assisted_damage`,
          stunNumber: sql`EXCLUDED.stun_number`,
          stunAssistedDamage: sql`EXCLUDED.stun_assisted_damage`,
          // COALESCE on the four optional ones: a mode that stops reporting an
          // armour figure, or a record score Wargaming drops, must not wipe
          // what we already hold. The counters above are in every block, so
          // they overwrite unconditionally.
          piercings: sql`COALESCE(EXCLUDED.piercings, ${table.piercings})`,
          damageBlocked: sql`COALESCE(EXCLUDED.damage_blocked, ${table.damageBlocked})`,
          tankingFactor: sql`COALESCE(EXCLUDED.tanking_factor, ${table.tankingFactor})`,
          maxDamage: sql`COALESCE(EXCLUDED.max_damage, ${table.maxDamage})`,
          maxXp: sql`COALESCE(EXCLUDED.max_xp, ${table.maxXp})`,
          maxFrags: sql`COALESCE(EXCLUDED.max_frags, ${table.maxFrags})`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      });
  }
}

/** One player's per-mode records on one vehicle. Empty for a vehicle only ever
 * taken into Random Battles, which is most of them. */
export async function getTankModeRows(
  region: Region,
  playerId: number,
  tankId: number,
): Promise<TankModeRow[]> {
  const table = tankModesByRegion[region];
  return db
    .select()
    .from(table)
    .where(and(eq(table.playerId, playerId), eq(table.tankId, tankId)));
}

/**
 * Every per-mode row this player has, across every vehicle.
 *
 * One read rather than one per mode, because the garage table's mode view needs
 * `clan` and `company` whatever mode was asked for: Random is derived from them
 * and the vehicle snapshot, so a view of Random reads the same rows as a view of
 * Skirmish. Keyed on the player, which the (player, mode) index serves by its
 * own prefix.
 *
 * Narrow rows and few of them: 0.256 per played vehicle on a random sample of
 * the accounts we track, so a couple of hundred for a clan player and none at
 * all for someone who only plays Random.
 */
export async function getPlayerModeRows(
  region: Region,
  playerId: number,
): Promise<TankModeRow[]> {
  const table = tankModesByRegion[region];
  return db.select().from(table).where(eq(table.playerId, playerId));
}

/** The rows grouped by vehicle, which is how both readers consume them. */
export function groupModeRowsByTank(rows: TankModeRow[]): Map<number, TankModeRow[]> {
  const out = new Map<number, TankModeRow[]>();
  for (const row of rows) {
    const list = out.get(row.tankId);
    if (list) list.push(row);
    else out.set(row.tankId, [row]);
  }
  return out;
}
