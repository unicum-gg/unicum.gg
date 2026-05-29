import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/services/db";
import {
  type NewPlayerSnapshot,
  type Player,
  type PlayerSnapshot,
  playerSnapshots,
  players,
} from "@/services/db/schema";
import type { PlayerInfo } from "@/services/wargaming/wot/accounts";
import type { Region } from "@/services/wargaming/wot";

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
  };
}

function snapshotFromInfo(playerId: number, info: PlayerInfo): NewPlayerSnapshot {
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
  };
}

export type SnapshotContext = {
  player: Player;
  latest: PlayerSnapshot;
};

export async function recordCurrentSnapshot(
  region: Region,
  info: PlayerInfo,
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
    .orderBy(desc(playerSnapshots.takenAt))
    .limit(1);

  const stale =
    !latest ||
    Date.now() - latest.takenAt.getTime() > SNAPSHOT_THROTTLE_MS ||
    latest.battles !== info.statistics.all.battles;

  if (!stale) {
    return { player, latest };
  }

  const [inserted] = await db
    .insert(playerSnapshots)
    .values(snapshotFromInfo(player.id, info))
    .onConflictDoNothing({
      target: [playerSnapshots.playerId, playerSnapshots.battles],
    })
    .returning();

  if (inserted) return { player, latest: inserted };

  const [winner] = await db
    .select()
    .from(playerSnapshots)
    .where(eq(playerSnapshots.playerId, player.id))
    .orderBy(desc(playerSnapshots.takenAt))
    .limit(1);
  return { player, latest: winner };
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
