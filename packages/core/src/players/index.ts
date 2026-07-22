import { and, asc, desc, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import { db } from "@unicum.gg/core/db";
import { type NewPlayerSnapshot, type Player, type PlayerSnapshot, playerSnapshotsByRegion, playersByRegion, tankSnapshotsByRegion, computeAvgTier, buildWN8Fallback, computeWN7, computeWN8, computeWNX, type Stats, type StrongholdStats } from "@unicum.gg/shared";
import { discoverClansBackground } from "@unicum.gg/core/discovery/clans";
import { discoverFromClanHistoryBackground } from "@unicum.gg/core/discovery/player-history";
import { playerChannel, publish } from "@unicum.gg/core/live/pubsub";
import type { Region } from "@unicum.gg/wargaming";
import type {
  PlayerInfo,
  PlayerSearchResult,
} from "@unicum.gg/core/wargaming/wot/accounts";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { fetchPlayerMarksOnGun } from "./marks";
import { bulkInsertTankSnapshots, diffTanks } from "./tanks";

const SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000; // 1 hour

export type { Stats, StrongholdStats };

export type SnapshotContext = {
  player: Player;
  latest: PlayerSnapshot;
};

export async function findPlayerByNicknameInDB(
  region: Region,
  nickname: string,
): Promise<PlayerSearchResult | null> {
  const players = playersByRegion[region];
  const [row] = await db
    .select({ accountId: players.accountId, nickname: players.nickname })
    .from(players)
    .where(sql`LOWER(${players.nickname}) = LOWER(${nickname})`)
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

export function skirmishStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.skirmishBattles === null) return null;
  return {
    battles: s.skirmishBattles,
    wins: s.skirmishWins ?? 0,
    losses: s.skirmishLosses ?? 0,
    draws: s.skirmishDraws ?? 0,
    survivedBattles: s.skirmishSurvivedBattles ?? 0,
    frags: s.skirmishFrags ?? 0,
    damageDealt: s.skirmishDamageDealt ?? 0,
    spotted: s.skirmishSpotted ?? 0,
    capturePoints: s.skirmishCapturePoints ?? 0,
    droppedCapturePoints: s.skirmishDroppedCapturePoints ?? 0,
    battleAvgXp: s.skirmishBattleAvgXp ?? 0,
  };
}

export function fortifiedStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.fortifiedBattles === null) return null;
  return {
    battles: s.fortifiedBattles,
    wins: s.fortifiedWins ?? 0,
    losses: s.fortifiedLosses ?? 0,
    draws: s.fortifiedDraws ?? 0,
    survivedBattles: s.fortifiedSurvivedBattles ?? 0,
    frags: s.fortifiedFrags ?? 0,
    damageDealt: s.fortifiedDamageDealt ?? 0,
    spotted: s.fortifiedSpotted ?? 0,
    capturePoints: s.fortifiedCapturePoints ?? 0,
    droppedCapturePoints: s.fortifiedDroppedCapturePoints ?? 0,
    battleAvgXp: s.fortifiedBattleAvgXp ?? 0,
  };
}

export function diffStrongholdStats(
  curr: StrongholdStats,
  prev: StrongholdStats,
): StrongholdStats {
  return {
    battles: curr.battles - prev.battles,
    wins: curr.wins - prev.wins,
    losses: curr.losses - prev.losses,
    draws: curr.draws - prev.draws,
    survivedBattles: curr.survivedBattles - prev.survivedBattles,
    frags: curr.frags - prev.frags,
    damageDealt: curr.damageDealt - prev.damageDealt,
    spotted: curr.spotted - prev.spotted,
    capturePoints: curr.capturePoints - prev.capturePoints,
    droppedCapturePoints: curr.droppedCapturePoints - prev.droppedCapturePoints,
    battleAvgXp: curr.battleAvgXp - prev.battleAvgXp,
  };
}

export function epicStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.epicBattles === null) return null;
  return {
    battles: s.epicBattles,
    wins: s.epicWins ?? 0,
    losses: s.epicLosses ?? 0,
    draws: s.epicDraws ?? 0,
    survivedBattles: s.epicSurvivedBattles ?? 0,
    frags: s.epicFrags ?? 0,
    damageDealt: s.epicDamageDealt ?? 0,
    spotted: s.epicSpotted ?? 0,
    capturePoints: s.epicCapturePoints ?? 0,
    droppedCapturePoints: s.epicDroppedCapturePoints ?? 0,
    battleAvgXp: s.epicBattleAvgXp ?? 0,
  };
}

export function falloutStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.falloutBattles === null) return null;
  return {
    battles: s.falloutBattles,
    wins: s.falloutWins ?? 0,
    losses: s.falloutLosses ?? 0,
    draws: s.falloutDraws ?? 0,
    survivedBattles: s.falloutSurvivedBattles ?? 0,
    frags: s.falloutFrags ?? 0,
    damageDealt: s.falloutDamageDealt ?? 0,
    spotted: s.falloutSpotted ?? 0,
    capturePoints: s.falloutCapturePoints ?? 0,
    droppedCapturePoints: s.falloutDroppedCapturePoints ?? 0,
    battleAvgXp: s.falloutBattleAvgXp ?? 0,
  };
}

export function rankedStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.rankedBattles === null) return null;
  return {
    battles: s.rankedBattles,
    wins: s.rankedWins ?? 0,
    losses: s.rankedLosses ?? 0,
    draws: s.rankedDraws ?? 0,
    survivedBattles: s.rankedSurvivedBattles ?? 0,
    frags: s.rankedFrags ?? 0,
    damageDealt: s.rankedDamageDealt ?? 0,
    spotted: s.rankedSpotted ?? 0,
    capturePoints: s.rankedCapturePoints ?? 0,
    droppedCapturePoints: s.rankedDroppedCapturePoints ?? 0,
    battleAvgXp: s.rankedBattleAvgXp ?? 0,
  };
}

export function cwAbsoluteStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.cwAbsoluteBattles === null) return null;
  return {
    battles: s.cwAbsoluteBattles,
    wins: s.cwAbsoluteWins ?? 0,
    losses: s.cwAbsoluteLosses ?? 0,
    draws: s.cwAbsoluteDraws ?? 0,
    survivedBattles: s.cwAbsoluteSurvivedBattles ?? 0,
    frags: s.cwAbsoluteFrags ?? 0,
    damageDealt: s.cwAbsoluteDamageDealt ?? 0,
    spotted: s.cwAbsoluteSpotted ?? 0,
    capturePoints: s.cwAbsoluteCapturePoints ?? 0,
    droppedCapturePoints: s.cwAbsoluteDroppedCapturePoints ?? 0,
    battleAvgXp: s.cwAbsoluteBattleAvgXp ?? 0,
  };
}

export function cwChampionStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.cwChampionBattles === null) return null;
  return {
    battles: s.cwChampionBattles,
    wins: s.cwChampionWins ?? 0,
    losses: s.cwChampionLosses ?? 0,
    draws: s.cwChampionDraws ?? 0,
    survivedBattles: s.cwChampionSurvivedBattles ?? 0,
    frags: s.cwChampionFrags ?? 0,
    damageDealt: s.cwChampionDamageDealt ?? 0,
    spotted: s.cwChampionSpotted ?? 0,
    capturePoints: s.cwChampionCapturePoints ?? 0,
    droppedCapturePoints: s.cwChampionDroppedCapturePoints ?? 0,
    battleAvgXp: s.cwChampionBattleAvgXp ?? 0,
  };
}

export function cwMiddleStatsFromSnapshot(s: PlayerSnapshot): StrongholdStats | null {
  if (s.cwMiddleBattles === null) return null;
  return {
    battles: s.cwMiddleBattles,
    wins: s.cwMiddleWins ?? 0,
    losses: s.cwMiddleLosses ?? 0,
    draws: s.cwMiddleDraws ?? 0,
    survivedBattles: s.cwMiddleSurvivedBattles ?? 0,
    frags: s.cwMiddleFrags ?? 0,
    damageDealt: s.cwMiddleDamageDealt ?? 0,
    spotted: s.cwMiddleSpotted ?? 0,
    capturePoints: s.cwMiddleCapturePoints ?? 0,
    droppedCapturePoints: s.cwMiddleDroppedCapturePoints ?? 0,
    battleAvgXp: s.cwMiddleBattleAvgXp ?? 0,
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
  const sk = info.statistics.stronghold_skirmish;
  const fo = info.statistics.stronghold_defense;
  const ep = info.statistics.epic;
  const fa = info.statistics.fallout;
  const rk = info.statistics.ranked_battles;
  const cwa = info.statistics.globalmap_absolute;
  const cwc = info.statistics.globalmap_champion;
  const cwm = info.statistics.globalmap_middle;
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
    skirmishBattles: sk?.battles ?? null,
    skirmishWins: sk?.wins ?? null,
    skirmishLosses: sk?.losses ?? null,
    skirmishDraws: sk?.draws ?? null,
    skirmishSurvivedBattles: sk?.survived_battles ?? null,
    skirmishFrags: sk?.frags ?? null,
    skirmishDamageDealt: sk?.damage_dealt ?? null,
    skirmishSpotted: sk?.spotted ?? null,
    skirmishCapturePoints: sk?.capture_points ?? null,
    skirmishDroppedCapturePoints: sk?.dropped_capture_points ?? null,
    skirmishBattleAvgXp: sk?.battle_avg_xp ?? null,
    fortifiedBattles: fo?.battles ?? null,
    fortifiedWins: fo?.wins ?? null,
    fortifiedLosses: fo?.losses ?? null,
    fortifiedDraws: fo?.draws ?? null,
    fortifiedSurvivedBattles: fo?.survived_battles ?? null,
    fortifiedFrags: fo?.frags ?? null,
    fortifiedDamageDealt: fo?.damage_dealt ?? null,
    fortifiedSpotted: fo?.spotted ?? null,
    fortifiedCapturePoints: fo?.capture_points ?? null,
    fortifiedDroppedCapturePoints: fo?.dropped_capture_points ?? null,
    fortifiedBattleAvgXp: fo?.battle_avg_xp ?? null,
    epicBattles: ep?.battles ?? null,
    epicWins: ep?.wins ?? null,
    epicLosses: ep?.losses ?? null,
    epicDraws: ep?.draws ?? null,
    epicSurvivedBattles: ep?.survived_battles ?? null,
    epicFrags: ep?.frags ?? null,
    epicDamageDealt: ep?.damage_dealt ?? null,
    epicSpotted: ep?.spotted ?? null,
    epicCapturePoints: ep?.capture_points ?? null,
    epicDroppedCapturePoints: ep?.dropped_capture_points ?? null,
    epicBattleAvgXp: ep?.battle_avg_xp ?? null,
    falloutBattles: fa?.battles ?? null,
    falloutWins: fa?.wins ?? null,
    falloutLosses: fa?.losses ?? null,
    falloutDraws: fa?.draws ?? null,
    falloutSurvivedBattles: fa?.survived_battles ?? null,
    falloutFrags: fa?.frags ?? null,
    falloutDamageDealt: fa?.damage_dealt ?? null,
    falloutSpotted: fa?.spotted ?? null,
    falloutCapturePoints: fa?.capture_points ?? null,
    falloutDroppedCapturePoints: fa?.dropped_capture_points ?? null,
    falloutBattleAvgXp: fa?.battle_avg_xp ?? null,
    rankedBattles: rk?.battles ?? null,
    rankedWins: rk?.wins ?? null,
    rankedLosses: rk?.losses ?? null,
    rankedDraws: rk?.draws ?? null,
    rankedSurvivedBattles: rk?.survived_battles ?? null,
    rankedFrags: rk?.frags ?? null,
    rankedDamageDealt: rk?.damage_dealt ?? null,
    rankedSpotted: rk?.spotted ?? null,
    rankedCapturePoints: rk?.capture_points ?? null,
    rankedDroppedCapturePoints: rk?.dropped_capture_points ?? null,
    rankedBattleAvgXp: rk?.battle_avg_xp ?? null,
    cwAbsoluteBattles: cwa?.battles ?? null,
    cwAbsoluteWins: cwa?.wins ?? null,
    cwAbsoluteLosses: cwa?.losses ?? null,
    cwAbsoluteDraws: cwa?.draws ?? null,
    cwAbsoluteSurvivedBattles: cwa?.survived_battles ?? null,
    cwAbsoluteFrags: cwa?.frags ?? null,
    cwAbsoluteDamageDealt: cwa?.damage_dealt ?? null,
    cwAbsoluteSpotted: cwa?.spotted ?? null,
    cwAbsoluteCapturePoints: cwa?.capture_points ?? null,
    cwAbsoluteDroppedCapturePoints: cwa?.dropped_capture_points ?? null,
    cwAbsoluteBattleAvgXp: cwa?.battle_avg_xp ?? null,
    cwChampionBattles: cwc?.battles ?? null,
    cwChampionWins: cwc?.wins ?? null,
    cwChampionLosses: cwc?.losses ?? null,
    cwChampionDraws: cwc?.draws ?? null,
    cwChampionSurvivedBattles: cwc?.survived_battles ?? null,
    cwChampionFrags: cwc?.frags ?? null,
    cwChampionDamageDealt: cwc?.damage_dealt ?? null,
    cwChampionSpotted: cwc?.spotted ?? null,
    cwChampionCapturePoints: cwc?.capture_points ?? null,
    cwChampionDroppedCapturePoints: cwc?.dropped_capture_points ?? null,
    cwChampionBattleAvgXp: cwc?.battle_avg_xp ?? null,
    cwMiddleBattles: cwm?.battles ?? null,
    cwMiddleWins: cwm?.wins ?? null,
    cwMiddleLosses: cwm?.losses ?? null,
    cwMiddleDraws: cwm?.draws ?? null,
    cwMiddleSurvivedBattles: cwm?.survived_battles ?? null,
    cwMiddleFrags: cwm?.frags ?? null,
    cwMiddleDamageDealt: cwm?.damage_dealt ?? null,
    cwMiddleSpotted: cwm?.spotted ?? null,
    cwMiddleCapturePoints: cwm?.capture_points ?? null,
    cwMiddleDroppedCapturePoints: cwm?.dropped_capture_points ?? null,
    cwMiddleBattleAvgXp: cwm?.battle_avg_xp ?? null,
  };
}

export async function markPlayerSeen(
  region: Region,
  info: PlayerInfo,
): Promise<Player> {
  const players = playersByRegion[region];
  const createdAt = new Date(info.created_at * 1000);
  const lastBattleAt = new Date(info.last_battle_time * 1000);
  const [player] = await db
    .insert(players)
    .values({
      accountId: info.account_id,
      nickname: info.nickname,
      createdAt,
      lastBattleAt,
      clanId: info.clan_id,
    })
    .onConflictDoUpdate({
      target: players.accountId,
      set: {
        nickname: info.nickname,
        createdAt,
        lastBattleAt,
        clanId: info.clan_id,
        lastSeenAt: new Date(),
      },
    })
    .returning();
  if (info.clan_id !== null) {
    discoverClansBackground(region, [info.clan_id]);
  }
  return player;
}

export async function recordCurrentSnapshot(
  region: Region,
  info: PlayerInfo,
  wtr: number | null = null,
  tanks: TankStats[] = [],
  // Fetch fresh Marks of Excellence from the clan portal. The portal is capped
  // at ~1 RPS/region, so the bulk backfill passes `false` (it would otherwise
  // serialise snapshot writes to one player per second and wreck on-time
  // freshness); the on-demand/page-view paths keep it `true`.
  fetchMarks: boolean = true,
): Promise<SnapshotContext> {
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const createdAt = new Date(info.created_at * 1000);
  const lastBattleAt = new Date(info.last_battle_time * 1000);
  const [player] = await db
    .insert(players)
    .values({
      accountId: info.account_id,
      nickname: info.nickname,
      createdAt,
      lastBattleAt,
      clanId: info.clan_id,
    })
    .onConflictDoUpdate({
      target: players.accountId,
      set: {
        nickname: info.nickname,
        createdAt,
        lastBattleAt,
        clanId: info.clan_id,
        lastSeenAt: new Date(),
      },
    })
    .returning();

  if (info.clan_id !== null) {
    discoverClansBackground(region, [info.clan_id]);
  }

  const [latest] = await db
    .select()
    .from(playerSnapshots)
    .where(eq(playerSnapshots.playerId, player.id))
    .orderBy(desc(playerSnapshots.takenAt), desc(playerSnapshots.id))
    .limit(1);

  if (!latest) {
    discoverFromClanHistoryBackground(region, info.account_id);
  }

  const stale =
    !latest ||
    Date.now() - latest.takenAt.getTime() > SNAPSHOT_THROTTLE_MS ||
    latest.battles !== info.statistics.all.battles;

  if (!stale) {
    if (tanks.length > 0) {
      await bulkInsertTankSnapshots(region, player.id, tanks);
      await updatePlayerRatings(region, player.id, info, tanks);
    }
    return { player, latest: await backfillWtr(region, latest, wtr) };
  }

  const snap = snapshotFromInfo(player.id, info, wtr);
  const [inserted] = await db
    .insert(playerSnapshots)
    .values(snap)
    .onConflictDoUpdate({
      target: [playerSnapshots.playerId, playerSnapshots.battles],
      set: {
        skirmishBattles: snap.skirmishBattles,
        skirmishWins: snap.skirmishWins,
        skirmishLosses: snap.skirmishLosses,
        skirmishDraws: snap.skirmishDraws,
        skirmishSurvivedBattles: snap.skirmishSurvivedBattles,
        skirmishFrags: snap.skirmishFrags,
        skirmishDamageDealt: snap.skirmishDamageDealt,
        skirmishSpotted: snap.skirmishSpotted,
        skirmishCapturePoints: snap.skirmishCapturePoints,
        skirmishDroppedCapturePoints: snap.skirmishDroppedCapturePoints,
        skirmishBattleAvgXp: snap.skirmishBattleAvgXp,
        fortifiedBattles: snap.fortifiedBattles,
        fortifiedWins: snap.fortifiedWins,
        fortifiedLosses: snap.fortifiedLosses,
        fortifiedDraws: snap.fortifiedDraws,
        fortifiedSurvivedBattles: snap.fortifiedSurvivedBattles,
        fortifiedFrags: snap.fortifiedFrags,
        fortifiedDamageDealt: snap.fortifiedDamageDealt,
        fortifiedSpotted: snap.fortifiedSpotted,
        fortifiedCapturePoints: snap.fortifiedCapturePoints,
        fortifiedDroppedCapturePoints: snap.fortifiedDroppedCapturePoints,
        fortifiedBattleAvgXp: snap.fortifiedBattleAvgXp,
        epicBattles: snap.epicBattles,
        epicWins: snap.epicWins,
        epicLosses: snap.epicLosses,
        epicDraws: snap.epicDraws,
        epicSurvivedBattles: snap.epicSurvivedBattles,
        epicFrags: snap.epicFrags,
        epicDamageDealt: snap.epicDamageDealt,
        epicSpotted: snap.epicSpotted,
        epicCapturePoints: snap.epicCapturePoints,
        epicDroppedCapturePoints: snap.epicDroppedCapturePoints,
        epicBattleAvgXp: snap.epicBattleAvgXp,
        falloutBattles: snap.falloutBattles,
        falloutWins: snap.falloutWins,
        falloutLosses: snap.falloutLosses,
        falloutDraws: snap.falloutDraws,
        falloutSurvivedBattles: snap.falloutSurvivedBattles,
        falloutFrags: snap.falloutFrags,
        falloutDamageDealt: snap.falloutDamageDealt,
        falloutSpotted: snap.falloutSpotted,
        falloutCapturePoints: snap.falloutCapturePoints,
        falloutDroppedCapturePoints: snap.falloutDroppedCapturePoints,
        falloutBattleAvgXp: snap.falloutBattleAvgXp,
        rankedBattles: snap.rankedBattles,
        rankedWins: snap.rankedWins,
        rankedLosses: snap.rankedLosses,
        rankedDraws: snap.rankedDraws,
        rankedSurvivedBattles: snap.rankedSurvivedBattles,
        rankedFrags: snap.rankedFrags,
        rankedDamageDealt: snap.rankedDamageDealt,
        rankedSpotted: snap.rankedSpotted,
        rankedCapturePoints: snap.rankedCapturePoints,
        rankedDroppedCapturePoints: snap.rankedDroppedCapturePoints,
        rankedBattleAvgXp: snap.rankedBattleAvgXp,
        cwAbsoluteBattles: snap.cwAbsoluteBattles,
        cwAbsoluteWins: snap.cwAbsoluteWins,
        cwAbsoluteLosses: snap.cwAbsoluteLosses,
        cwAbsoluteDraws: snap.cwAbsoluteDraws,
        cwAbsoluteSurvivedBattles: snap.cwAbsoluteSurvivedBattles,
        cwAbsoluteFrags: snap.cwAbsoluteFrags,
        cwAbsoluteDamageDealt: snap.cwAbsoluteDamageDealt,
        cwAbsoluteSpotted: snap.cwAbsoluteSpotted,
        cwAbsoluteCapturePoints: snap.cwAbsoluteCapturePoints,
        cwAbsoluteDroppedCapturePoints: snap.cwAbsoluteDroppedCapturePoints,
        cwAbsoluteBattleAvgXp: snap.cwAbsoluteBattleAvgXp,
        cwChampionBattles: snap.cwChampionBattles,
        cwChampionWins: snap.cwChampionWins,
        cwChampionLosses: snap.cwChampionLosses,
        cwChampionDraws: snap.cwChampionDraws,
        cwChampionSurvivedBattles: snap.cwChampionSurvivedBattles,
        cwChampionFrags: snap.cwChampionFrags,
        cwChampionDamageDealt: snap.cwChampionDamageDealt,
        cwChampionSpotted: snap.cwChampionSpotted,
        cwChampionCapturePoints: snap.cwChampionCapturePoints,
        cwChampionDroppedCapturePoints: snap.cwChampionDroppedCapturePoints,
        cwChampionBattleAvgXp: snap.cwChampionBattleAvgXp,
        cwMiddleBattles: snap.cwMiddleBattles,
        cwMiddleWins: snap.cwMiddleWins,
        cwMiddleLosses: snap.cwMiddleLosses,
        cwMiddleDraws: snap.cwMiddleDraws,
        cwMiddleSurvivedBattles: snap.cwMiddleSurvivedBattles,
        cwMiddleFrags: snap.cwMiddleFrags,
        cwMiddleDamageDealt: snap.cwMiddleDamageDealt,
        cwMiddleSpotted: snap.cwMiddleSpotted,
        cwMiddleCapturePoints: snap.cwMiddleCapturePoints,
        cwMiddleDroppedCapturePoints: snap.cwMiddleDroppedCapturePoints,
        cwMiddleBattleAvgXp: snap.cwMiddleBattleAvgXp,
      },
    })
    .returning();

  if (tanks.length > 0) {
    if (fetchMarks) {
      // A fresh snapshot means the player has played, so Marks of Excellence may
      // have moved — enrich from the portal (the public API doesn't expose them)
      // before writing. Only here (not the no-new-battles fast path) since marks
      // can't change without battles. Fail-open: no marks this cycle on a blip.
      const marks = await fetchPlayerMarksOnGun(region, info.account_id);
      if (marks.size > 0) {
        for (const t of tanks) {
          const m = marks.get(t.tank_id);
          if (m != null) t.marks_on_gun = m;
        }
      }
    } else {
      // Bulk path: skip the 1 RPS portal call and carry the last known marks
      // forward so a new-battles snapshot doesn't reset the Marks column to
      // null. Fresh marks land on the next on-demand (page-view) refresh.
      await carryForwardMarks(region, player.id, tanks);
    }
    await bulkInsertTankSnapshots(region, player.id, tanks);
    await updatePlayerRatings(region, player.id, info, tanks);
  }
  publish(playerChannel(region, info.account_id), { kind: "snapshot" });

  if (inserted) return { player, latest: inserted };

  const [winner] = await db
    .select()
    .from(playerSnapshots)
    .where(eq(playerSnapshots.playerId, player.id))
    .orderBy(desc(playerSnapshots.takenAt), desc(playerSnapshots.id))
    .limit(1);
  return { player, latest: await backfillWtr(region, winner, wtr) };
}

/**
 * Copy each tank's last known Marks of Excellence onto the incoming stats, so a
 * marks-less bulk snapshot (backfill) never resets the Marks column to null on
 * a new-battles row. Reads the newest non-null value per tank; genuinely fresh
 * marks come from the portal on the on-demand (page-view) path.
 */
async function carryForwardMarks(
  region: Region,
  playerId: number,
  tanks: TankStats[],
): Promise<void> {
  const tankSnapshots = tankSnapshotsByRegion[region];
  const rows = await db
    .selectDistinctOn([tankSnapshots.tankId], {
      tankId: tankSnapshots.tankId,
      marksOnGun: tankSnapshots.marksOnGun,
    })
    .from(tankSnapshots)
    .where(
      and(
        eq(tankSnapshots.playerId, playerId),
        isNotNull(tankSnapshots.marksOnGun),
      ),
    )
    .orderBy(
      tankSnapshots.tankId,
      desc(tankSnapshots.takenAt),
      desc(tankSnapshots.id),
    );
  if (rows.length === 0) return;
  const byTank = new Map(rows.map((r) => [r.tankId, r.marksOnGun]));
  for (const t of tanks) {
    const m = byTank.get(t.tank_id);
    if (m != null) t.marks_on_gun = m;
  }
}

/**
 * Refresh the cached wn7/wn8/wnx/wnx30d on the players row from the just
 * inserted tank snapshot set. Called inside `recordCurrentSnapshot` so every
 * fresh snapshot keeps the ratings in lockstep with the underlying data —
 * the clan members table and the player page both read these cached values
 * instead of computing at request time.
 */
async function updatePlayerRatings(
  region: Region,
  playerId: number,
  info: PlayerInfo,
  tanks: TankStats[],
): Promise<void> {
  const players = playersByRegion[region];
  const tankSnapshots = tankSnapshotsByRegion[region];
  const [encyclopedia, wn8Expected, wnxExpected] = await Promise.all([
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
  ]);

  const overall = info.statistics.all;
  const avgTier = computeAvgTier(tanks, encyclopedia);
  const wn7 =
    overall.battles > 0
      ? computeWN7(
          {
            battles: overall.battles,
            wins: overall.wins,
            frags: overall.frags,
            damageDealt: overall.damage_dealt,
            spotted: overall.spotted,
            droppedCapturePoints: overall.dropped_capture_points,
          },
          avgTier,
        )
      : null;
  const wn8Fallback = buildWN8Fallback(wn8Expected, encyclopedia);
  const wn8 = computeWN8(tanks, wn8Expected, encyclopedia, wn8Fallback);
  const wnx = computeWNX(tanks, wnxExpected);

  // Recent-window ratings for each leaderboard period (24h / 7d / 30d). Per
  // tank we take the newest snapshot older than the cutoff, or (for players
  // tracked less than the window) the oldest snapshot other than the current
  // one, so a short history still reflects the games played instead of coming
  // back empty. Mirrors the player-page period baseline in initial-data.ts.
  // Cheap per-player DISTINCT-ON queries run in parallel; keeping these cached
  // columns in lockstep with every snapshot is what lets the top-players cron
  // rank by a column (see wargaming/wot/players/top) instead of scanning the
  // 300M-row tank_snapshots table every hour.
  const periodRating = async (cutoffMs: number) => {
    const cutoff = new Date(Date.now() - cutoffMs);
    const cutoffTs = sql`${cutoff.toISOString()}::timestamptz`;
    const rows = await db
      .selectDistinctOn([tankSnapshots.tankId], {
        tankId: tankSnapshots.tankId,
        battles: tankSnapshots.battles,
        wins: tankSnapshots.wins,
        damageDealt: tankSnapshots.damageDealt,
        spotted: tankSnapshots.spotted,
        frags: tankSnapshots.frags,
        droppedCapturePoints: tankSnapshots.droppedCapturePoints,
        radioAssistedDamage: tankSnapshots.radioAssistedDamage,
        trackAssistedDamage: tankSnapshots.trackAssistedDamage,
        xp: tankSnapshots.xp,
        markOfMastery: tankSnapshots.markOfMastery,
        takenAt: tankSnapshots.takenAt,
      })
      .from(tankSnapshots)
      .where(
        and(
          eq(tankSnapshots.playerId, playerId),
          or(
            lt(tankSnapshots.takenAt, cutoff),
            sql`${tankSnapshots.takenAt} < (SELECT MAX(ts2.taken_at) FROM ${tankSnapshots} ts2 WHERE ts2.player_id = ${playerId} AND ts2.tank_id = ${tankSnapshots.tankId})`,
          ),
        ),
      )
      .orderBy(
        tankSnapshots.tankId,
        sql`(${tankSnapshots.takenAt} < ${cutoffTs}) DESC`,
        sql`CASE WHEN ${tankSnapshots.takenAt} < ${cutoffTs} THEN ${tankSnapshots.takenAt} END DESC`,
        asc(tankSnapshots.takenAt),
        desc(tankSnapshots.id),
      );
    let pWn7: number | null = null;
    let pWn8: number | null = null;
    let pWnx: number | null = null;
    let pBattles: number | null = null;
    if (rows.length > 0) {
      const baseline = new Map(
        rows.map((r) => [
          r.tankId,
          {
            id: 0,
            playerId,
            tankId: r.tankId,
            takenAt: r.takenAt,
            battles: r.battles,
            wins: r.wins,
            damageDealt: r.damageDealt,
            spotted: r.spotted,
            frags: r.frags,
            droppedCapturePoints: r.droppedCapturePoints,
            radioAssistedDamage: r.radioAssistedDamage,
            trackAssistedDamage: r.trackAssistedDamage,
            xp: r.xp,
            markOfMastery: r.markOfMastery,
            // Not needed for the rating diff.
            marksOnGun: null,
            survivedBattles: null,
            hits: null,
            shots: null,
            piercings: null,
            damageBlocked: null,
          },
        ]),
      );
      const recent = diffTanks(tanks, baseline);
      if (recent.length > 0) {
        pWnx = computeWNX(recent, wnxExpected);
        pWn8 = computeWN8(recent, wn8Expected, encyclopedia, wn8Fallback);
        pBattles = recent.reduce((sum, t) => sum + t.all.battles, 0);
        // WN7 needs aggregate stats and the average tier over the same window.
        const agg = recent.reduce(
          (acc, t) => {
            acc.battles += t.all.battles;
            acc.wins += t.all.wins;
            acc.frags += t.all.frags;
            acc.damageDealt += t.all.damage_dealt;
            acc.spotted += t.all.spotted;
            acc.droppedCapturePoints += t.all.dropped_capture_points;
            return acc;
          },
          { battles: 0, wins: 0, frags: 0, damageDealt: 0, spotted: 0, droppedCapturePoints: 0 },
        );
        if (agg.battles > 0) {
          pWn7 = computeWN7(agg, computeAvgTier(recent, encyclopedia));
        }
      }
    }
    return { wn7: pWn7, wn8: pWn8, wnx: pWnx, battles: pBattles };
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const [p24h, p7d, p30d] = await Promise.all([
    periodRating(DAY_MS),
    periodRating(7 * DAY_MS),
    periodRating(30 * DAY_MS),
  ]);

  await db
    .update(players)
    .set({
      wn7,
      wn8,
      wnx,
      wn730d: p30d.wn7,
      wn830d: p30d.wn8,
      wnx30d: p30d.wnx,
      battles30d: p30d.battles,
      wn724h: p24h.wn7,
      wn824h: p24h.wn8,
      wnx24h: p24h.wnx,
      battles24h: p24h.battles,
      wn77d: p7d.wn7,
      wn87d: p7d.wn8,
      wnx7d: p7d.wnx,
      battles7d: p7d.battles,
      battles: overall.battles,
      winrate: overall.battles > 0 ? overall.wins / overall.battles : null,
    })
    .where(eq(players.id, playerId));
}

async function backfillWtr(
  region: Region,
  snapshot: PlayerSnapshot,
  wtr: number | null,
): Promise<PlayerSnapshot> {
  if (snapshot.wtr !== null || wtr === null) return snapshot;
  const playerSnapshots = playerSnapshotsByRegion[region];
  await db
    .update(playerSnapshots)
    .set({ wtr })
    .where(eq(playerSnapshots.id, snapshot.id));
  return { ...snapshot, wtr };
}

export async function getPlayerIdsByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, number>> {
  if (accountIds.length === 0) return new Map();
  const players = playersByRegion[region];
  const rows = await db
    .select({ id: players.id, accountId: players.accountId })
    .from(players)
    .where(inArray(players.accountId, accountIds));
  const map = new Map<number, number>();
  for (const r of rows) map.set(r.accountId, r.id);
  return map;
}

export async function getPlayersByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, Player>> {
  if (accountIds.length === 0) return new Map();
  const players = playersByRegion[region];
  const rows = await db
    .select()
    .from(players)
    .where(inArray(players.accountId, accountIds));
  const map = new Map<number, Player>();
  for (const r of rows) map.set(r.accountId, r);
  return map;
}

export async function getLatestPlayerSnapshotsByAccounts(
  region: Region,
  accountIds: number[],
): Promise<Map<number, PlayerSnapshot>> {
  if (accountIds.length === 0) return new Map();
  const playerSnapshots = playerSnapshotsByRegion[region];
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
    skirmish_battles: number | null;
    skirmish_wins: number | null;
    skirmish_losses: number | null;
    skirmish_draws: number | null;
    skirmish_survived_battles: number | null;
    skirmish_frags: number | null;
    skirmish_damage_dealt: number | null;
    skirmish_spotted: number | null;
    skirmish_capture_points: number | null;
    skirmish_dropped_capture_points: number | null;
    skirmish_battle_avg_xp: number | null;
    fortified_battles: number | null;
    fortified_wins: number | null;
    fortified_losses: number | null;
    fortified_draws: number | null;
    fortified_survived_battles: number | null;
    fortified_frags: number | null;
    fortified_damage_dealt: number | null;
    fortified_spotted: number | null;
    fortified_capture_points: number | null;
    fortified_dropped_capture_points: number | null;
    fortified_battle_avg_xp: number | null;
    epic_battles: number | null;
    epic_wins: number | null;
    epic_losses: number | null;
    epic_draws: number | null;
    epic_survived_battles: number | null;
    epic_frags: number | null;
    epic_damage_dealt: number | null;
    epic_spotted: number | null;
    epic_capture_points: number | null;
    epic_dropped_capture_points: number | null;
    epic_battle_avg_xp: number | null;
    fallout_battles: number | null;
    fallout_wins: number | null;
    fallout_losses: number | null;
    fallout_draws: number | null;
    fallout_survived_battles: number | null;
    fallout_frags: number | null;
    fallout_damage_dealt: number | null;
    fallout_spotted: number | null;
    fallout_capture_points: number | null;
    fallout_dropped_capture_points: number | null;
    fallout_battle_avg_xp: number | null;
    ranked_battles: number | null;
    ranked_wins: number | null;
    ranked_losses: number | null;
    ranked_draws: number | null;
    ranked_survived_battles: number | null;
    ranked_frags: number | null;
    ranked_damage_dealt: number | null;
    ranked_spotted: number | null;
    ranked_capture_points: number | null;
    ranked_dropped_capture_points: number | null;
    ranked_battle_avg_xp: number | null;
    cw_absolute_battles: number | null;
    cw_absolute_wins: number | null;
    cw_absolute_losses: number | null;
    cw_absolute_draws: number | null;
    cw_absolute_survived_battles: number | null;
    cw_absolute_frags: number | null;
    cw_absolute_damage_dealt: number | null;
    cw_absolute_spotted: number | null;
    cw_absolute_capture_points: number | null;
    cw_absolute_dropped_capture_points: number | null;
    cw_absolute_battle_avg_xp: number | null;
    cw_champion_battles: number | null;
    cw_champion_wins: number | null;
    cw_champion_losses: number | null;
    cw_champion_draws: number | null;
    cw_champion_survived_battles: number | null;
    cw_champion_frags: number | null;
    cw_champion_damage_dealt: number | null;
    cw_champion_spotted: number | null;
    cw_champion_capture_points: number | null;
    cw_champion_dropped_capture_points: number | null;
    cw_champion_battle_avg_xp: number | null;
    cw_middle_battles: number | null;
    cw_middle_wins: number | null;
    cw_middle_losses: number | null;
    cw_middle_draws: number | null;
    cw_middle_survived_battles: number | null;
    cw_middle_frags: number | null;
    cw_middle_damage_dealt: number | null;
    cw_middle_spotted: number | null;
    cw_middle_capture_points: number | null;
    cw_middle_dropped_capture_points: number | null;
    cw_middle_battle_avg_xp: number | null;
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
      takenAt: row.taken_at instanceof Date ? row.taken_at : new Date(row.taken_at),
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
      skirmishBattles: row.skirmish_battles == null ? null : Number(row.skirmish_battles),
      skirmishWins: row.skirmish_wins == null ? null : Number(row.skirmish_wins),
      skirmishLosses: row.skirmish_losses == null ? null : Number(row.skirmish_losses),
      skirmishDraws: row.skirmish_draws == null ? null : Number(row.skirmish_draws),
      skirmishSurvivedBattles: row.skirmish_survived_battles == null ? null : Number(row.skirmish_survived_battles),
      skirmishFrags: row.skirmish_frags == null ? null : Number(row.skirmish_frags),
      skirmishDamageDealt: row.skirmish_damage_dealt == null ? null : Number(row.skirmish_damage_dealt),
      skirmishSpotted: row.skirmish_spotted == null ? null : Number(row.skirmish_spotted),
      skirmishCapturePoints: row.skirmish_capture_points == null ? null : Number(row.skirmish_capture_points),
      skirmishDroppedCapturePoints: row.skirmish_dropped_capture_points == null ? null : Number(row.skirmish_dropped_capture_points),
      skirmishBattleAvgXp: row.skirmish_battle_avg_xp == null ? null : Number(row.skirmish_battle_avg_xp),
      fortifiedBattles: row.fortified_battles == null ? null : Number(row.fortified_battles),
      fortifiedWins: row.fortified_wins == null ? null : Number(row.fortified_wins),
      fortifiedLosses: row.fortified_losses == null ? null : Number(row.fortified_losses),
      fortifiedDraws: row.fortified_draws == null ? null : Number(row.fortified_draws),
      fortifiedSurvivedBattles: row.fortified_survived_battles == null ? null : Number(row.fortified_survived_battles),
      fortifiedFrags: row.fortified_frags == null ? null : Number(row.fortified_frags),
      fortifiedDamageDealt: row.fortified_damage_dealt == null ? null : Number(row.fortified_damage_dealt),
      fortifiedSpotted: row.fortified_spotted == null ? null : Number(row.fortified_spotted),
      fortifiedCapturePoints: row.fortified_capture_points == null ? null : Number(row.fortified_capture_points),
      fortifiedDroppedCapturePoints: row.fortified_dropped_capture_points == null ? null : Number(row.fortified_dropped_capture_points),
      fortifiedBattleAvgXp: row.fortified_battle_avg_xp == null ? null : Number(row.fortified_battle_avg_xp),
      epicBattles: row.epic_battles == null ? null : Number(row.epic_battles),
      epicWins: row.epic_wins == null ? null : Number(row.epic_wins),
      epicLosses: row.epic_losses == null ? null : Number(row.epic_losses),
      epicDraws: row.epic_draws == null ? null : Number(row.epic_draws),
      epicSurvivedBattles: row.epic_survived_battles == null ? null : Number(row.epic_survived_battles),
      epicFrags: row.epic_frags == null ? null : Number(row.epic_frags),
      epicDamageDealt: row.epic_damage_dealt == null ? null : Number(row.epic_damage_dealt),
      epicSpotted: row.epic_spotted == null ? null : Number(row.epic_spotted),
      epicCapturePoints: row.epic_capture_points == null ? null : Number(row.epic_capture_points),
      epicDroppedCapturePoints: row.epic_dropped_capture_points == null ? null : Number(row.epic_dropped_capture_points),
      epicBattleAvgXp: row.epic_battle_avg_xp == null ? null : Number(row.epic_battle_avg_xp),
      falloutBattles: row.fallout_battles == null ? null : Number(row.fallout_battles),
      falloutWins: row.fallout_wins == null ? null : Number(row.fallout_wins),
      falloutLosses: row.fallout_losses == null ? null : Number(row.fallout_losses),
      falloutDraws: row.fallout_draws == null ? null : Number(row.fallout_draws),
      falloutSurvivedBattles: row.fallout_survived_battles == null ? null : Number(row.fallout_survived_battles),
      falloutFrags: row.fallout_frags == null ? null : Number(row.fallout_frags),
      falloutDamageDealt: row.fallout_damage_dealt == null ? null : Number(row.fallout_damage_dealt),
      falloutSpotted: row.fallout_spotted == null ? null : Number(row.fallout_spotted),
      falloutCapturePoints: row.fallout_capture_points == null ? null : Number(row.fallout_capture_points),
      falloutDroppedCapturePoints: row.fallout_dropped_capture_points == null ? null : Number(row.fallout_dropped_capture_points),
      falloutBattleAvgXp: row.fallout_battle_avg_xp == null ? null : Number(row.fallout_battle_avg_xp),
      rankedBattles: row.ranked_battles == null ? null : Number(row.ranked_battles),
      rankedWins: row.ranked_wins == null ? null : Number(row.ranked_wins),
      rankedLosses: row.ranked_losses == null ? null : Number(row.ranked_losses),
      rankedDraws: row.ranked_draws == null ? null : Number(row.ranked_draws),
      rankedSurvivedBattles: row.ranked_survived_battles == null ? null : Number(row.ranked_survived_battles),
      rankedFrags: row.ranked_frags == null ? null : Number(row.ranked_frags),
      rankedDamageDealt: row.ranked_damage_dealt == null ? null : Number(row.ranked_damage_dealt),
      rankedSpotted: row.ranked_spotted == null ? null : Number(row.ranked_spotted),
      rankedCapturePoints: row.ranked_capture_points == null ? null : Number(row.ranked_capture_points),
      rankedDroppedCapturePoints: row.ranked_dropped_capture_points == null ? null : Number(row.ranked_dropped_capture_points),
      rankedBattleAvgXp: row.ranked_battle_avg_xp == null ? null : Number(row.ranked_battle_avg_xp),
      cwAbsoluteBattles: row.cw_absolute_battles == null ? null : Number(row.cw_absolute_battles),
      cwAbsoluteWins: row.cw_absolute_wins == null ? null : Number(row.cw_absolute_wins),
      cwAbsoluteLosses: row.cw_absolute_losses == null ? null : Number(row.cw_absolute_losses),
      cwAbsoluteDraws: row.cw_absolute_draws == null ? null : Number(row.cw_absolute_draws),
      cwAbsoluteSurvivedBattles: row.cw_absolute_survived_battles == null ? null : Number(row.cw_absolute_survived_battles),
      cwAbsoluteFrags: row.cw_absolute_frags == null ? null : Number(row.cw_absolute_frags),
      cwAbsoluteDamageDealt: row.cw_absolute_damage_dealt == null ? null : Number(row.cw_absolute_damage_dealt),
      cwAbsoluteSpotted: row.cw_absolute_spotted == null ? null : Number(row.cw_absolute_spotted),
      cwAbsoluteCapturePoints: row.cw_absolute_capture_points == null ? null : Number(row.cw_absolute_capture_points),
      cwAbsoluteDroppedCapturePoints: row.cw_absolute_dropped_capture_points == null ? null : Number(row.cw_absolute_dropped_capture_points),
      cwAbsoluteBattleAvgXp: row.cw_absolute_battle_avg_xp == null ? null : Number(row.cw_absolute_battle_avg_xp),
      cwChampionBattles: row.cw_champion_battles == null ? null : Number(row.cw_champion_battles),
      cwChampionWins: row.cw_champion_wins == null ? null : Number(row.cw_champion_wins),
      cwChampionLosses: row.cw_champion_losses == null ? null : Number(row.cw_champion_losses),
      cwChampionDraws: row.cw_champion_draws == null ? null : Number(row.cw_champion_draws),
      cwChampionSurvivedBattles: row.cw_champion_survived_battles == null ? null : Number(row.cw_champion_survived_battles),
      cwChampionFrags: row.cw_champion_frags == null ? null : Number(row.cw_champion_frags),
      cwChampionDamageDealt: row.cw_champion_damage_dealt == null ? null : Number(row.cw_champion_damage_dealt),
      cwChampionSpotted: row.cw_champion_spotted == null ? null : Number(row.cw_champion_spotted),
      cwChampionCapturePoints: row.cw_champion_capture_points == null ? null : Number(row.cw_champion_capture_points),
      cwChampionDroppedCapturePoints: row.cw_champion_dropped_capture_points == null ? null : Number(row.cw_champion_dropped_capture_points),
      cwChampionBattleAvgXp: row.cw_champion_battle_avg_xp == null ? null : Number(row.cw_champion_battle_avg_xp),
      cwMiddleBattles: row.cw_middle_battles == null ? null : Number(row.cw_middle_battles),
      cwMiddleWins: row.cw_middle_wins == null ? null : Number(row.cw_middle_wins),
      cwMiddleLosses: row.cw_middle_losses == null ? null : Number(row.cw_middle_losses),
      cwMiddleDraws: row.cw_middle_draws == null ? null : Number(row.cw_middle_draws),
      cwMiddleSurvivedBattles: row.cw_middle_survived_battles == null ? null : Number(row.cw_middle_survived_battles),
      cwMiddleFrags: row.cw_middle_frags == null ? null : Number(row.cw_middle_frags),
      cwMiddleDamageDealt: row.cw_middle_damage_dealt == null ? null : Number(row.cw_middle_damage_dealt),
      cwMiddleSpotted: row.cw_middle_spotted == null ? null : Number(row.cw_middle_spotted),
      cwMiddleCapturePoints: row.cw_middle_capture_points == null ? null : Number(row.cw_middle_capture_points),
      cwMiddleDroppedCapturePoints: row.cw_middle_dropped_capture_points == null ? null : Number(row.cw_middle_dropped_capture_points),
      cwMiddleBattleAvgXp: row.cw_middle_battle_avg_xp == null ? null : Number(row.cw_middle_battle_avg_xp),
    });
  }
  return out;
}
