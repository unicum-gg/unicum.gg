import { sql } from "drizzle-orm";
import { traced } from "@/lib/perf-trace";
import { db } from "@/services/db";
import {
  type Player,
  type PlayerSnapshot,
  type TankSnapshot,
  playerClanHistoryByRegion,
  playerSnapshotsByRegion,
  playersByRegion,
  tankSnapshotsByRegion,
} from "@/services/db/schema";
import type { Region } from "@/services/wargaming/wot";
import type { PlayerClanHistoryFull } from "@/services/wargaming/wot/clans/player";
import {
  type SerializedClanHistory,
  deserializeClanHistory,
} from "./clan-history";
import type { TankSnapshotMap } from "./tanks";

type RawPlayer = {
  id: number;
  account_id: number;
  nickname: string;
  created_at: string | null;
  last_battle_at: string | null;
  clan_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  wnx_recent: number | null;
};

type RawPlayerSnapshot = {
  id: number;
  player_id: number;
  taken_at: string;
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
};

type RawTankSnapshot = {
  id: number;
  player_id: number;
  tank_id: number;
  taken_at: string;
  battles: number;
  wins: number;
  damage_dealt: number;
  spotted: number;
  frags: number;
  dropped_capture_points: number;
  radio_assisted_damage: number;
  track_assisted_damage: number;
};

type RawClanHistory = {
  fetched_at: string;
  data: unknown;
};

export type PlayerInitialData = {
  player: Player | null;
  latestSnapshot: PlayerSnapshot | null;
  latestTankSnapshots: TankSnapshot[];
  clanHistory: { fetchedAt: Date; data: PlayerClanHistoryFull } | null;
  periodSnapshots: {
    h24: PlayerSnapshot | null;
    d7: PlayerSnapshot | null;
    d30: PlayerSnapshot | null;
  };
  periodTankSnapshots: {
    h24: TankSnapshotMap;
    d7: TankSnapshotMap;
    d30: TankSnapshotMap;
  };
};

function playerFromRaw(r: RawPlayer): Player {
  return {
    id: r.id,
    accountId: Number(r.account_id),
    nickname: r.nickname,
    createdAt: r.created_at ? new Date(r.created_at) : null,
    lastBattleAt: r.last_battle_at ? new Date(r.last_battle_at) : null,
    clanId: r.clan_id === null ? null : Number(r.clan_id),
    firstSeenAt: new Date(r.first_seen_at),
    lastSeenAt: new Date(r.last_seen_at),
    wn7: r.wn7,
    wn8: r.wn8,
    wnx: r.wnx,
    wnxRecent: r.wnx_recent,
  };
}

function snapshotFromRaw(r: RawPlayerSnapshot): PlayerSnapshot {
  return {
    id: Number(r.id),
    playerId: Number(r.player_id),
    takenAt: new Date(r.taken_at),
    battles: Number(r.battles),
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws),
    survivedBattles: Number(r.survived_battles),
    frags: Number(r.frags),
    damageDealt: Number(r.damage_dealt),
    damageReceived: Number(r.damage_received),
    xp: Number(r.xp),
    battleAvgXp: Number(r.battle_avg_xp),
    spotted: Number(r.spotted),
    capturePoints: Number(r.capture_points),
    droppedCapturePoints: Number(r.dropped_capture_points),
    hits: Number(r.hits),
    shots: Number(r.shots),
    hitsPercents: Number(r.hits_percents),
    globalRating: Number(r.global_rating),
    wtr: r.wtr === null ? null : Number(r.wtr),
    clanId: r.clan_id === null ? null : Number(r.clan_id),
  };
}

function tankSnapshotFromRaw(r: RawTankSnapshot): TankSnapshot {
  return {
    id: Number(r.id),
    playerId: Number(r.player_id),
    tankId: Number(r.tank_id),
    takenAt: new Date(r.taken_at),
    battles: Number(r.battles),
    wins: Number(r.wins),
    damageDealt: Number(r.damage_dealt),
    spotted: Number(r.spotted),
    frags: Number(r.frags),
    droppedCapturePoints: Number(r.dropped_capture_points),
    radioAssistedDamage: Number(r.radio_assisted_damage),
    trackAssistedDamage: Number(r.track_assisted_damage),
  };
}

function tankSnapshotMapFromRaws(rows: RawTankSnapshot[] | null): TankSnapshotMap {
  const map: TankSnapshotMap = new Map();
  if (!rows) return map;
  for (const r of rows) map.set(Number(r.tank_id), tankSnapshotFromRaw(r));
  return map;
}


export type PlayerLookup = { accountId: number } | { nickname: string };

export async function loadPlayerInitialData(
  region: Region,
  lookup: PlayerLookup,
): Promise<PlayerInitialData> {
  const players = playersByRegion[region];
  const playerSnapshots = playerSnapshotsByRegion[region];
  const tankSnapshots = tankSnapshotsByRegion[region];
  const playerClanHistory = playerClanHistoryByRegion[region];

  const matchClause =
    "accountId" in lookup
      ? sql`account_id = ${lookup.accountId}`
      : sql`LOWER(nickname) = LOWER(${lookup.nickname})`;
  const accountIdClause =
    "accountId" in lookup
      ? sql`${lookup.accountId}::bigint`
      : sql`(SELECT account_id FROM p)`;
  const rows = (await traced("db loadPlayerInitialData", () => db.execute(sql`
    WITH p AS (
      SELECT *
      FROM ${players}
      WHERE ${matchClause}
      LIMIT 1
    ),
    latest_snap AS (
      SELECT * FROM ${playerSnapshots}
      WHERE player_id = (SELECT id FROM p)
      ORDER BY taken_at DESC, id DESC
      LIMIT 1
    ),
    latest_tanks AS (
      SELECT DISTINCT ON (tank_id) *
      FROM ${tankSnapshots}
      WHERE player_id = (SELECT id FROM p)
      ORDER BY tank_id, taken_at DESC, id DESC
    ),
    snap_24h AS (
      SELECT * FROM ${playerSnapshots}
      WHERE player_id = (SELECT id FROM p)
        AND taken_at < NOW() - INTERVAL '24 hours'
      ORDER BY taken_at DESC, id DESC LIMIT 1
    ),
    snap_7d AS (
      SELECT * FROM ${playerSnapshots}
      WHERE player_id = (SELECT id FROM p)
        AND taken_at < NOW() - INTERVAL '7 days'
      ORDER BY taken_at DESC, id DESC LIMIT 1
    ),
    snap_30d AS (
      SELECT * FROM ${playerSnapshots}
      WHERE player_id = (SELECT id FROM p)
        AND taken_at < NOW() - INTERVAL '30 days'
      ORDER BY taken_at DESC, id DESC LIMIT 1
    ),
    tanks_24h AS (
      SELECT DISTINCT ON (tank_id) *
      FROM ${tankSnapshots}
      WHERE player_id = (SELECT id FROM p)
        AND taken_at < NOW() - INTERVAL '24 hours'
      ORDER BY tank_id, taken_at DESC, id DESC
    ),
    tanks_7d AS (
      SELECT DISTINCT ON (tank_id) *
      FROM ${tankSnapshots}
      WHERE player_id = (SELECT id FROM p)
        AND taken_at < NOW() - INTERVAL '7 days'
      ORDER BY tank_id, taken_at DESC, id DESC
    ),
    tanks_30d AS (
      SELECT DISTINCT ON (tank_id) *
      FROM ${tankSnapshots}
      WHERE player_id = (SELECT id FROM p)
        AND taken_at < NOW() - INTERVAL '30 days'
      ORDER BY tank_id, taken_at DESC, id DESC
    )
    SELECT
      (SELECT row_to_json(p.*) FROM p) AS player,
      (SELECT row_to_json(latest_snap.*) FROM latest_snap) AS latest_snapshot,
      (SELECT json_agg(latest_tanks.*) FROM latest_tanks) AS latest_tank_snapshots,
      (SELECT row_to_json(ch.*)
       FROM ${playerClanHistory} ch
       WHERE ch.account_id = ${accountIdClause}
       LIMIT 1) AS clan_history,
      (SELECT row_to_json(snap_24h.*) FROM snap_24h) AS snap_24h,
      (SELECT row_to_json(snap_7d.*) FROM snap_7d) AS snap_7d,
      (SELECT row_to_json(snap_30d.*) FROM snap_30d) AS snap_30d,
      (SELECT json_agg(tanks_24h.*) FROM tanks_24h) AS tanks_24h,
      (SELECT json_agg(tanks_7d.*) FROM tanks_7d) AS tanks_7d,
      (SELECT json_agg(tanks_30d.*) FROM tanks_30d) AS tanks_30d
  `))) as unknown as Array<{
    player: RawPlayer | null;
    latest_snapshot: RawPlayerSnapshot | null;
    latest_tank_snapshots: RawTankSnapshot[] | null;
    clan_history: RawClanHistory | null;
    snap_24h: RawPlayerSnapshot | null;
    snap_7d: RawPlayerSnapshot | null;
    snap_30d: RawPlayerSnapshot | null;
    tanks_24h: RawTankSnapshot[] | null;
    tanks_7d: RawTankSnapshot[] | null;
    tanks_30d: RawTankSnapshot[] | null;
  }>;

  const row = rows[0];

  return {
    player: row.player ? playerFromRaw(row.player) : null,
    latestSnapshot: row.latest_snapshot ? snapshotFromRaw(row.latest_snapshot) : null,
    latestTankSnapshots: (row.latest_tank_snapshots ?? []).map(tankSnapshotFromRaw),
    clanHistory: row.clan_history
      ? {
          fetchedAt: new Date(row.clan_history.fetched_at),
          data: deserializeClanHistory(row.clan_history.data as SerializedClanHistory),
        }
      : null,
    periodSnapshots: {
      h24: row.snap_24h ? snapshotFromRaw(row.snap_24h) : null,
      d7: row.snap_7d ? snapshotFromRaw(row.snap_7d) : null,
      d30: row.snap_30d ? snapshotFromRaw(row.snap_30d) : null,
    },
    periodTankSnapshots: {
      h24: tankSnapshotMapFromRaws(row.tanks_24h),
      d7: tankSnapshotMapFromRaws(row.tanks_7d),
      d30: tankSnapshotMapFromRaws(row.tanks_30d),
    },
  };
}
