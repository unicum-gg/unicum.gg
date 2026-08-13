import { sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import {
  type NewTankSnapshot,
  type TankSnapshot,
  tankSnapshotsByRegion,
} from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { getPlayerIdsByAccounts } from ".";

const TANK_INSERT_CHUNK = 500;

export type TankSnapshotMap = Map<number, TankSnapshot>;

function tankSnapshotFromStats(playerId: number, t: TankStats): NewTankSnapshot {
  const a = t.all;
  return {
    playerId,
    tankId: t.tank_id,
    battles: a.battles,
    wins: a.wins,
    damageDealt: a.damage_dealt,
    spotted: a.spotted,
    frags: a.frags,
    droppedCapturePoints: a.dropped_capture_points,
    radioAssistedDamage: a.radio_assisted_damage,
    trackAssistedDamage: a.track_assisted_damage,
    xp: a.xp,
    markOfMastery: t.mark_of_mastery,
    marksOnGun: t.marks_on_gun ?? null,
    survivedBattles: a.survived_battles ?? null,
    hits: a.hits ?? null,
    shots: a.shots ?? null,
    piercings: a.piercings ?? null,
    // WG only exposes the per-battle average; store the cumulative total so it
    // aggregates like the other counters.
    damageBlocked:
      a.avg_damage_blocked != null
        ? Math.round(a.avg_damage_blocked * a.battles)
        : null,
    damageReceived: a.damage_received ?? null,
    capturePoints: a.capture_points ?? null,
    stunNumber: a.stun_number ?? null,
    stunAssistedDamage: a.stun_assisted_damage ?? null,
    // A ratio, not a counter: stored as WG reports it (see the schema).
    tankingFactor: a.tanking_factor ?? null,
    maxXp: t.max_xp ?? null,
    maxFrags: t.max_frags ?? null,
  };
}

export async function bulkInsertTankSnapshots(
  region: Region,
  playerId: number,
  tanks: TankStats[],
): Promise<void> {
  const table = tankSnapshotsByRegion[region];
  const rows = tanks
    .filter((t) => t.all.battles > 0)
    .map((t) => tankSnapshotFromStats(playerId, t));
  for (let i = 0; i < rows.length; i += TANK_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + TANK_INSERT_CHUNK);
    await db
      .insert(table)
      .values(chunk)
      .onConflictDoUpdate({
        // Same (player, tank, battles) means we've already seen this exact
        // state, so all the count columns must be identical. We only refresh
        // the columns that were added by later migrations and might still be
        // NULL on older rows (xp from 0008, mark_of_mastery from 0008). We
        // overwrite unconditionally rather than guarding on NULL so a buggy
        // earlier write that put 0 instead of NULL also gets corrected.
        target: [table.playerId, table.tankId, table.battles],
        set: {
          xp: sql`EXCLUDED.xp`,
          markOfMastery: sql`EXCLUDED.mark_of_mastery`,
          // Marks come from the portal, which we only reach on some refreshes.
          // COALESCE so a marks-less insert never wipes a previously-stored
          // value (unlike the columns above, which are always in the API row).
          marksOnGun: sql`COALESCE(EXCLUDED.marks_on_gun, ${table.marksOnGun})`,
          survivedBattles: sql`EXCLUDED.survived_battles`,
          hits: sql`EXCLUDED.hits`,
          shots: sql`EXCLUDED.shots`,
          piercings: sql`EXCLUDED.piercings`,
          damageBlocked: sql`EXCLUDED.damage_blocked`,
          damageReceived: sql`EXCLUDED.damage_received`,
          capturePoints: sql`EXCLUDED.capture_points`,
          stunNumber: sql`EXCLUDED.stun_number`,
          stunAssistedDamage: sql`EXCLUDED.stun_assisted_damage`,
          tankingFactor: sql`EXCLUDED.tanking_factor`,
          maxXp: sql`EXCLUDED.max_xp`,
          maxFrags: sql`EXCLUDED.max_frags`,
        },
      });
  }
}

export async function getLatestTankSnapshotsByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankSnapshot[]>> {
  if (accountIds.length === 0) return new Map();
  const tankSnapshots = tankSnapshotsByRegion[region];
  const idMap = await getPlayerIdsByAccounts(region, accountIds);
  const playerIds = Array.from(idMap.values());
  if (playerIds.length === 0) return new Map();

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (player_id, tank_id) *
    FROM ${tankSnapshots}
    WHERE player_id IN ${sql.raw(`(${playerIds.join(",")})`)}
    ORDER BY player_id, tank_id, taken_at DESC, battles DESC
  `)) as unknown as Array<{
    player_id: number;
    tank_id: number;
    taken_at: Date;
    battles: number;
    wins: number;
    damage_dealt: number;
    spotted: number;
    frags: number;
    dropped_capture_points: number;
    radio_assisted_damage: number;
    track_assisted_damage: number;
    xp: number | null;
    mark_of_mastery: number | null;
  }>;

  const playerIdToAccount = new Map<number, number>();
  for (const [accountId, playerId] of idMap) {
    playerIdToAccount.set(playerId, accountId);
  }

  const out = new Map<number, TankSnapshot[]>();
  for (const row of rows) {
    const accountId = playerIdToAccount.get(row.player_id);
    if (accountId === undefined) continue;
    const arr = out.get(accountId) ?? [];
    arr.push({
      playerId: Number(row.player_id),
      tankId: Number(row.tank_id),
      takenAt: row.taken_at instanceof Date ? row.taken_at : new Date(row.taken_at),
      battles: Number(row.battles),
      wins: Number(row.wins),
      damageDealt: Number(row.damage_dealt),
      spotted: Number(row.spotted),
      frags: Number(row.frags),
      droppedCapturePoints: Number(row.dropped_capture_points),
      radioAssistedDamage: Number(row.radio_assisted_damage),
      trackAssistedDamage: Number(row.track_assisted_damage),
      xp: row.xp == null ? null : Number(row.xp),
      markOfMastery: row.mark_of_mastery == null ? null : Number(row.mark_of_mastery),
      marksOnGun: null,
      survivedBattles: null,
      hits: null,
      shots: null,
      piercings: null,
      damageBlocked: null,
      damageReceived: null,
      capturePoints: null,
      stunNumber: null,
      stunAssistedDamage: null,
      tankingFactor: null,
      maxXp: null,
      maxFrags: null,
    });
    out.set(accountId, arr);
  }
  return out;
}

/**
 * Batch variant of `getLatestTankSnapshotsByAccounts` that returns, per
 * account, the latest tank snapshot taken strictly before `cutoff`. Used to
 * build per-member period diffs (e.g. clan-wide d7 WNX) in one SQL round-trip
 * instead of N queries.
 */
export async function getTankSnapshotsByAccountsBefore(
  region: Region,
  accountIds: number[],
  cutoff: Date,
): Promise<Map<number, TankSnapshot[]>> {
  if (accountIds.length === 0) return new Map();
  const tankSnapshots = tankSnapshotsByRegion[region];
  const idMap = await getPlayerIdsByAccounts(region, accountIds);
  const playerIds = Array.from(idMap.values());
  if (playerIds.length === 0) return new Map();

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (player_id, tank_id) *
    FROM ${tankSnapshots}
    WHERE player_id IN ${sql.raw(`(${playerIds.join(",")})`)}
      AND taken_at < ${cutoff.toISOString()}
    ORDER BY player_id, tank_id, taken_at DESC, battles DESC
  `)) as unknown as Array<{
    player_id: number;
    tank_id: number;
    taken_at: Date;
    battles: number;
    wins: number;
    damage_dealt: number;
    spotted: number;
    frags: number;
    dropped_capture_points: number;
    radio_assisted_damage: number;
    track_assisted_damage: number;
    xp: number | null;
    mark_of_mastery: number | null;
  }>;

  const playerIdToAccount = new Map<number, number>();
  for (const [accountId, playerId] of idMap) {
    playerIdToAccount.set(playerId, accountId);
  }

  const out = new Map<number, TankSnapshot[]>();
  for (const row of rows) {
    const accountId = playerIdToAccount.get(row.player_id);
    if (accountId === undefined) continue;
    const arr = out.get(accountId) ?? [];
    arr.push({
      playerId: Number(row.player_id),
      tankId: Number(row.tank_id),
      takenAt:
        row.taken_at instanceof Date ? row.taken_at : new Date(row.taken_at),
      battles: Number(row.battles),
      wins: Number(row.wins),
      damageDealt: Number(row.damage_dealt),
      spotted: Number(row.spotted),
      frags: Number(row.frags),
      droppedCapturePoints: Number(row.dropped_capture_points),
      radioAssistedDamage: Number(row.radio_assisted_damage),
      trackAssistedDamage: Number(row.track_assisted_damage),
      xp: row.xp == null ? null : Number(row.xp),
      markOfMastery: row.mark_of_mastery == null ? null : Number(row.mark_of_mastery),
      marksOnGun: null,
      survivedBattles: null,
      hits: null,
      shots: null,
      piercings: null,
      damageBlocked: null,
      damageReceived: null,
      capturePoints: null,
      stunNumber: null,
      stunAssistedDamage: null,
      tankingFactor: null,
      maxXp: null,
      maxFrags: null,
    });
    out.set(accountId, arr);
  }
  return out;
}

export function tankSnapshotsToTankStats(
  snapshots: TankSnapshot[],
): TankStats[] {
  return snapshots.map((s) => ({
    tank_id: s.tankId,
    mark_of_mastery: s.markOfMastery,
    marks_on_gun: s.marksOnGun,
    all: {
      battles: s.battles,
      wins: s.wins,
      damage_dealt: s.damageDealt,
      spotted: s.spotted,
      frags: s.frags,
      dropped_capture_points: s.droppedCapturePoints,
      radio_assisted_damage: s.radioAssistedDamage,
      track_assisted_damage: s.trackAssistedDamage,
      xp: Number.isFinite(s.xp) ? (s.xp as number) : 0,
    },
  }));
}

export function diffTanks(
  current: TankStats[],
  past: TankSnapshotMap,
): TankStats[] {
  const out: TankStats[] = [];
  for (const t of current) {
    const p = past.get(t.tank_id);
    if (!p) continue;
    const battlesDiff = t.all.battles - p.battles;
    if (battlesDiff <= 0) continue;
    out.push({
      tank_id: t.tank_id,
      mark_of_mastery: t.mark_of_mastery,
      all: {
        battles: battlesDiff,
        wins: t.all.wins - p.wins,
        damage_dealt: t.all.damage_dealt - p.damageDealt,
        spotted: t.all.spotted - p.spotted,
        frags: t.all.frags - p.frags,
        dropped_capture_points:
          t.all.dropped_capture_points - p.droppedCapturePoints,
        radio_assisted_damage:
          t.all.radio_assisted_damage - p.radioAssistedDamage,
        track_assisted_damage:
          t.all.track_assisted_damage - p.trackAssistedDamage,
        xp: t.all.xp - (p.xp ?? 0),
      },
    });
  }
  return out;
}
