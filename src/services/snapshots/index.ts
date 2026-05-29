import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type NewPlayerSnapshot,
  type NewTankSnapshot,
  type Player,
  type PlayerSnapshot,
  playerSnapshots,
  players,
  type TankSnapshot,
  tankSnapshots,
} from "@/services/db/schema";
import type { PlayerInfo } from "@/services/wargaming/wot/accounts";
import type { Region } from "@/services/wargaming/wot";
import type { TankStats } from "@/services/wargaming/wot/tanks";

const SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

export type Stats = {
  battles: number;
  wins: number;
  losses: number;
  draws: number;
  survivedBattles: number;
  frags: number;
  damageDealt: number;
  xp: number;
  spotted: number;
  capturePoints: number;
  droppedCapturePoints: number;
  hits: number;
  shots: number;
  globalRating: number;
  wtr: number | null;
};

export function statsFromSnapshot(s: PlayerSnapshot): Stats {
  return {
    battles: s.battles,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    survivedBattles: s.survivedBattles,
    frags: s.frags,
    damageDealt: s.damageDealt,
    xp: s.xp,
    spotted: s.spotted,
    capturePoints: s.capturePoints,
    droppedCapturePoints: s.droppedCapturePoints,
    hits: s.hits,
    shots: s.shots,
    globalRating: s.globalRating,
    wtr: s.wtr,
  };
}

export function diffStats(curr: Stats, prev: Stats): Stats {
  return {
    battles: curr.battles - prev.battles,
    wins: curr.wins - prev.wins,
    losses: curr.losses - prev.losses,
    draws: curr.draws - prev.draws,
    survivedBattles: curr.survivedBattles - prev.survivedBattles,
    frags: curr.frags - prev.frags,
    damageDealt: curr.damageDealt - prev.damageDealt,
    xp: curr.xp - prev.xp,
    spotted: curr.spotted - prev.spotted,
    capturePoints: curr.capturePoints - prev.capturePoints,
    droppedCapturePoints: curr.droppedCapturePoints - prev.droppedCapturePoints,
    hits: curr.hits - prev.hits,
    shots: curr.shots - prev.shots,
    globalRating: curr.globalRating - prev.globalRating,
    wtr:
      curr.wtr !== null && prev.wtr !== null ? curr.wtr - prev.wtr : null,
  };
}

function snapshotFromInfo(
  playerId: number,
  info: PlayerInfo,
  wtr: number | null,
): NewPlayerSnapshot {
  const s = info.statistics.all;
  return {
    playerId,
    battles: s.battles,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    survivedBattles: s.survived_battles,
    frags: s.frags,
    damageDealt: s.damage_dealt,
    damageReceived: s.damage_received,
    xp: s.xp,
    battleAvgXp: s.battle_avg_xp,
    spotted: s.spotted,
    capturePoints: s.capture_points,
    droppedCapturePoints: s.dropped_capture_points,
    hits: s.hits,
    shots: s.shots,
    hitsPercents: s.hits_percents,
    globalRating: info.global_rating,
    wtr,
  };
}

export type SnapshotContext = {
  player: Player;
  latest: PlayerSnapshot;
};

const TANK_INSERT_CHUNK = 500;

function tankSnapshotFromStats(playerId: number, t: TankStats): NewTankSnapshot {
  return {
    playerId,
    tankId: t.tank_id,
    battles: t.all.battles,
    wins: t.all.wins,
    damageDealt: t.all.damage_dealt,
    spotted: t.all.spotted,
    frags: t.all.frags,
    droppedCapturePoints: t.all.dropped_capture_points,
    radioAssistedDamage: t.all.radio_assisted_damage,
    trackAssistedDamage: t.all.track_assisted_damage,
  };
}

async function bulkInsertTankSnapshots(
  playerId: number,
  tanks: TankStats[],
): Promise<void> {
  const rows = tanks
    .filter((t) => t.all.battles > 0)
    .map((t) => tankSnapshotFromStats(playerId, t));
  for (let i = 0; i < rows.length; i += TANK_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + TANK_INSERT_CHUNK);
    await db
      .insert(tankSnapshots)
      .values(chunk)
      .onConflictDoNothing({
        target: [
          tankSnapshots.playerId,
          tankSnapshots.tankId,
          tankSnapshots.battles,
        ],
      });
  }
}

export async function recordCurrentSnapshot(
  region: Region,
  info: PlayerInfo,
  wtr: number | null = null,
  tanks: TankStats[] = [],
): Promise<SnapshotContext> {
  const [player] = await db
    .insert(players)
    .values({
      region,
      accountId: info.account_id,
      nickname: info.nickname,
    })
    .onConflictDoUpdate({
      target: [players.region, players.accountId],
      set: { nickname: info.nickname, lastSeenAt: new Date() },
    })
    .returning();

  const [latest] = await db
    .select()
    .from(playerSnapshots)
    .where(eq(playerSnapshots.playerId, player.id))
    .orderBy(desc(playerSnapshots.takenAt), desc(playerSnapshots.id))
    .limit(1);

  const stale =
    !latest ||
    Date.now() - latest.takenAt.getTime() > SNAPSHOT_THROTTLE_MS ||
    latest.battles !== info.statistics.all.battles;

  if (!stale) {
    if (tanks.length > 0) await bulkInsertTankSnapshots(player.id, tanks);
    return { player, latest: await backfillWtr(latest, wtr) };
  }

  const [inserted] = await db
    .insert(playerSnapshots)
    .values(snapshotFromInfo(player.id, info, wtr))
    .onConflictDoNothing({
      target: [playerSnapshots.playerId, playerSnapshots.battles],
    })
    .returning();

  if (tanks.length > 0) await bulkInsertTankSnapshots(player.id, tanks);

  if (inserted) return { player, latest: inserted };

  const [winner] = await db
    .select()
    .from(playerSnapshots)
    .where(eq(playerSnapshots.playerId, player.id))
    .orderBy(desc(playerSnapshots.takenAt), desc(playerSnapshots.id))
    .limit(1);
  return { player, latest: await backfillWtr(winner, wtr) };
}

async function backfillWtr(
  snapshot: PlayerSnapshot,
  wtr: number | null,
): Promise<PlayerSnapshot> {
  if (snapshot.wtr !== null || wtr === null) return snapshot;
  await db
    .update(playerSnapshots)
    .set({ wtr })
    .where(eq(playerSnapshots.id, snapshot.id));
  return { ...snapshot, wtr };
}

export type PeriodComparators = {
  h24: PlayerSnapshot | null;
  d7: PlayerSnapshot | null;
  d30: PlayerSnapshot | null;
};

export async function getPeriodComparators(
  playerId: number,
): Promise<PeriodComparators> {
  const now = Date.now();
  const cutoffs = {
    h24: new Date(now - 24 * 60 * 60 * 1000),
    d7: new Date(now - 7 * 24 * 60 * 60 * 1000),
    d30: new Date(now - 30 * 24 * 60 * 60 * 1000),
  };

  async function latestBefore(cutoff: Date): Promise<PlayerSnapshot | null> {
    const [row] = await db
      .select()
      .from(playerSnapshots)
      .where(
        and(
          eq(playerSnapshots.playerId, playerId),
          lte(playerSnapshots.takenAt, cutoff),
        ),
      )
      .orderBy(desc(playerSnapshots.takenAt))
      .limit(1);
    return row ?? null;
  }

  const [h24, d7, d30] = await Promise.all([
    latestBefore(cutoffs.h24),
    latestBefore(cutoffs.d7),
    latestBefore(cutoffs.d30),
  ]);

  return { h24, d7, d30 };
}

export type TankSnapshotMap = Map<number, TankSnapshot>;

export type PeriodTankComparators = {
  h24: TankSnapshotMap;
  d7: TankSnapshotMap;
  d30: TankSnapshotMap;
};

export async function getPeriodTankComparators(
  playerId: number,
): Promise<PeriodTankComparators> {
  const now = Date.now();
  const cutoffs = {
    h24: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    d7: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
    d30: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  async function tanksBefore(cutoff: string): Promise<TankSnapshotMap> {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (tank_id) *
      FROM ${tankSnapshots}
      WHERE player_id = ${playerId} AND taken_at < ${cutoff}
      ORDER BY tank_id, taken_at DESC, id DESC
    `);
    const map: TankSnapshotMap = new Map();
    for (const row of rows as unknown as Array<{
      id: number;
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
    }>) {
      map.set(row.tank_id, {
        id: row.id,
        playerId: row.player_id,
        tankId: row.tank_id,
        takenAt: row.taken_at,
        battles: row.battles,
        wins: row.wins,
        damageDealt: row.damage_dealt,
        spotted: row.spotted,
        frags: row.frags,
        droppedCapturePoints: row.dropped_capture_points,
        radioAssistedDamage: row.radio_assisted_damage,
        trackAssistedDamage: row.track_assisted_damage,
      });
    }
    return map;
  }

  const [h24, d7, d30] = await Promise.all([
    tanksBefore(cutoffs.h24),
    tanksBefore(cutoffs.d7),
    tanksBefore(cutoffs.d30),
  ]);

  return { h24, d7, d30 };
}

export async function getPlayerIdsByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, number>> {
  if (accountIds.length === 0) return new Map();
  const rows = await db
    .select({ id: players.id, accountId: players.accountId })
    .from(players)
    .where(
      and(
        eq(players.region, region),
        inArray(players.accountId, accountIds),
      ),
    );
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.accountId, r.id);
  return map;
}

export async function getLatestPlayerSnapshotsByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, PlayerSnapshot>> {
  if (accountIds.length === 0) return new Map();
  const idMap = await getPlayerIdsByAccounts(region, accountIds);
  const playerIds = Array.from(idMap.values());
  if (playerIds.length === 0) return new Map();

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (player_id) *
    FROM ${playerSnapshots}
    WHERE player_id IN ${sql.raw(`(${playerIds.join(",")})`)}
    ORDER BY player_id, taken_at DESC, id DESC
  `)) as unknown as Array<{
    id: number;
    player_id: number;
    taken_at: Date;
    battles: number;
    wins: number;
    losses: number;
    draws: number;
    survived_battles: number;
    frags: number;
    damage_dealt: number;
    damage_received: number;
    xp: number;
    battle_avg_xp: number;
    spotted: number;
    capture_points: number;
    dropped_capture_points: number;
    hits: number;
    shots: number;
    hits_percents: number;
    global_rating: number;
    wtr: number | null;
  }>;

  const playerIdToAccount = new Map<number, number>();
  for (const [accountId, playerId] of idMap) {
    playerIdToAccount.set(playerId, accountId);
  }

  const out = new Map<number, PlayerSnapshot>();
  for (const row of rows) {
    const accountId = playerIdToAccount.get(row.player_id);
    if (accountId === undefined) continue;
    out.set(accountId, {
      id: Number(row.id),
      playerId: Number(row.player_id),
      takenAt: row.taken_at,
      battles: Number(row.battles),
      wins: Number(row.wins),
      losses: Number(row.losses),
      draws: Number(row.draws),
      survivedBattles: Number(row.survived_battles),
      frags: Number(row.frags),
      damageDealt: Number(row.damage_dealt),
      damageReceived: Number(row.damage_received),
      xp: Number(row.xp),
      battleAvgXp: Number(row.battle_avg_xp),
      spotted: Number(row.spotted),
      capturePoints: Number(row.capture_points),
      droppedCapturePoints: Number(row.dropped_capture_points),
      hits: Number(row.hits),
      shots: Number(row.shots),
      hitsPercents: Number(row.hits_percents),
      globalRating: Number(row.global_rating),
      wtr: row.wtr === null ? null : Number(row.wtr),
    });
  }
  return out;
}

export async function getLatestTankSnapshotsByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, TankSnapshot[]>> {
  if (accountIds.length === 0) return new Map();
  const idMap = await getPlayerIdsByAccounts(region, accountIds);
  const playerIds = Array.from(idMap.values());
  if (playerIds.length === 0) return new Map();

  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (player_id, tank_id) *
    FROM ${tankSnapshots}
    WHERE player_id IN ${sql.raw(`(${playerIds.join(",")})`)}
    ORDER BY player_id, tank_id, taken_at DESC, id DESC
  `)) as unknown as Array<{
    id: number;
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
      id: Number(row.id),
      playerId: Number(row.player_id),
      tankId: Number(row.tank_id),
      takenAt: row.taken_at,
      battles: Number(row.battles),
      wins: Number(row.wins),
      damageDealt: Number(row.damage_dealt),
      spotted: Number(row.spotted),
      frags: Number(row.frags),
      droppedCapturePoints: Number(row.dropped_capture_points),
      radioAssistedDamage: Number(row.radio_assisted_damage),
      trackAssistedDamage: Number(row.track_assisted_damage),
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
    all: {
      battles: s.battles,
      wins: s.wins,
      damage_dealt: s.damageDealt,
      spotted: s.spotted,
      frags: s.frags,
      dropped_capture_points: s.droppedCapturePoints,
      radio_assisted_damage: s.radioAssistedDamage,
      track_assisted_damage: s.trackAssistedDamage,
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
      },
    });
  }
  return out;
}
