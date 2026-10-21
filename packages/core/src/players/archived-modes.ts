import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  PLAYER_ARCHIVED_MODES,
  playerArchivedMode,
  playerArchivedModesByRegion,
  type NewPlayerArchivedModeRow,
  type PlayerArchivedMode,
  type PlayerArchivedModeRow,
  type StrongholdStats,
} from "@unicum.gg/shared";
import type { PlayerInfo, PlayerStatistics } from "@unicum.gg/core/wargaming/wot/accounts";
import type { Region } from "@unicum.gg/wargaming";

/**
 * Write the modes an account can no longer play.
 *
 * Called from the snapshot write, off the SAME `account/info` response it
 * already has: these five blocks come back whether or not anything asked for
 * them, so this costs no Wargaming call and no extra byte on the wire.
 *
 * Upserts rather than inserting, because this is current state: see
 * `makePlayerArchivedModesTable` for why a finished total has no business in
 * the snapshot series.
 *
 * A mode with no battles is skipped rather than written as zeroes. That is what
 * keeps the table to the accounts that actually played these (most never did),
 * and it is also what makes the profile able to offer a tab only where there is
 * something behind it.
 */
export async function upsertPlayerArchivedModes(
  region: Region,
  playerId: number,
  info: PlayerInfo,
): Promise<void> {
  const table = playerArchivedModesByRegion[region];
  const rows: NewPlayerArchivedModeRow[] = [];
  for (const mode of PLAYER_ARCHIVED_MODES) {
    const block = info.statistics[mode] as PlayerStatistics | undefined;
    if (!block || block.battles <= 0) continue;
    rows.push({
      playerId,
      mode,
      battles: block.battles,
      wins: block.wins,
      losses: block.losses,
      draws: block.draws,
      survivedBattles: block.survived_battles,
      frags: block.frags,
      damageDealt: block.damage_dealt,
      spotted: block.spotted,
      capturePoints: block.capture_points,
      droppedCapturePoints: block.dropped_capture_points,
      battleAvgXp: block.battle_avg_xp,
      updatedAt: new Date(),
    });
  }
  if (rows.length === 0) return;

  await db
    .insert(table)
    .values(rows)
    .onConflictDoUpdate({
      target: [table.playerId, table.mode],
      set: {
        battles: sql`EXCLUDED.battles`,
        wins: sql`EXCLUDED.wins`,
        losses: sql`EXCLUDED.losses`,
        draws: sql`EXCLUDED.draws`,
        survivedBattles: sql`EXCLUDED.survived_battles`,
        frags: sql`EXCLUDED.frags`,
        damageDealt: sql`EXCLUDED.damage_dealt`,
        spotted: sql`EXCLUDED.spotted`,
        capturePoints: sql`EXCLUDED.capture_points`,
        droppedCapturePoints: sql`EXCLUDED.dropped_capture_points`,
        battleAvgXp: sql`EXCLUDED.battle_avg_xp`,
        updatedAt: sql`EXCLUDED.updated_at`,
      },
    });
}

/** The stored rows as the shape every mode panel on the profile renders. */
export function archivedModeStats(
  rows: PlayerArchivedModeRow[],
): Map<PlayerArchivedMode, StrongholdStats> {
  const out = new Map<PlayerArchivedMode, StrongholdStats>();
  for (const row of rows) {
    const mode = playerArchivedMode(row.mode);
    if (!mode) continue;
    out.set(mode, {
      battles: row.battles,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      survivedBattles: row.survivedBattles,
      frags: row.frags,
      damageDealt: row.damageDealt,
      spotted: row.spotted,
      capturePoints: row.capturePoints,
      droppedCapturePoints: row.droppedCapturePoints,
      battleAvgXp: row.battleAvgXp,
    });
  }
  return out;
}
