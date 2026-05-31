import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type NewPlayerSnapshot,
  type Player,
  type PlayerSnapshot,
  playerSnapshots,
  players,
} from "@/services/db/schema";
import type {
  PlayerInfo,
  PlayerSearchResult,
} from "@/services/wargaming/wot/accounts";
import type { Region } from "@/services/wargaming/wot";
import type { TankStats } from "@/services/wargaming/wot/tanks";
import { bulkInsertTankSnapshots } from "./tank";

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

export type SnapshotContext = {
  player: Player;
  latest: PlayerSnapshot;
};

export type PeriodComparators = {
  h24: PlayerSnapshot | null;
  d7: PlayerSnapshot | null;
  d30: PlayerSnapshot | null;
};

export async function findPlayerByNicknameInDB(
  region: Region,
  nickname: string,
): Promise<PlayerSearchResult | null> {
  const [row] = await db
    .select({ accountId: players.accountId, nickname: players.nickname })
    .from(players)
    .where(
      and(
        eq(players.region, region),
        sql`LOWER(${players.nickname}) = LOWER(${nickname})`,
      ),
    )
    .limit(1);
  if (!row) return null;
  return { account_id: row.accountId, nickname: row.nickname };
}

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
    clanId: info.clan_id,
  };
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
    clan_id: number | null;
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
      clanId: row.clan_id === null ? null : Number(row.clan_id),
    });
  }
  return out;
}
