import { sql } from "drizzle-orm";
import { traced, tracedSync } from "@unicum.gg/core/lib/perf-trace";
import { db } from "@unicum.gg/core/db";
import { type Player, type PlayerSnapshot, type TankSnapshot, playerClanHistoryByRegion, playerSnapshotsByRegion, playersByRegion, tankSnapshotsByRegion, type PlayerClanHistoryFull } from "@unicum.gg/shared";
import type { Region } from "@unicum.gg/wargaming";
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
  due_at: string;
  wn7: number | null;
  wn8: number | null;
  wnx: number | null;
  wn7_30d: number | null;
  wn8_30d: number | null;
  wnx_30d: number | null;
  wn7_24h: number | null;
  wn8_24h: number | null;
  wnx_24h: number | null;
  wn7_7d: number | null;
  wn8_7d: number | null;
  wnx_7d: number | null;
  battles: number | null;
  battles_30d: number | null;
  battles_24h: number | null;
  battles_7d: number | null;
  winrate: number | null;
  hr: number | null;
  sh_battles: number | null;
  sh_wins: number | null;
  sh_survived: number | null;
  sh_damage: number | string | null;
  sh_frags: number | null;
  sh_avg_xp: number | null;
  null_count: number;
  soft_deleted_at: string | null;
  tournament_wins: number;
  tournament_featured_wins: number;
  tournament_best_title: string | null;
  tournament_best_at: string | null;
  onslaught_best_tier: string | null;
  onslaught_best_rank: number | null;
  onslaught_seasons: number;
};

type RawPlayerSnapshot = {
  id: number;
  player_id: number;
  taken_at: string;
  last_battle_at: string | null;
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
};

type RawTankSnapshot = {
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
  xp: number | null;
  mark_of_mastery: number | null;
  marks_on_gun: number | null;
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
    dueAt: new Date(r.due_at),
    wn7: r.wn7,
    wn8: r.wn8,
    wnx: r.wnx,
    wn730d: r.wn7_30d,
    wn830d: r.wn8_30d,
    wnx30d: r.wnx_30d,
    wn724h: r.wn7_24h,
    wn824h: r.wn8_24h,
    wnx24h: r.wnx_24h,
    wn77d: r.wn7_7d,
    wn87d: r.wn8_7d,
    wnx7d: r.wnx_7d,
    battles: r.battles,
    battles30d: r.battles_30d,
    battles24h: r.battles_24h,
    battles7d: r.battles_7d,
    winrate: r.winrate,
    hr: r.hr,
    shBattles: r.sh_battles,
    shWins: r.sh_wins,
    shSurvived: r.sh_survived,
    shDamage: r.sh_damage === null ? null : Number(r.sh_damage),
    shFrags: r.sh_frags,
    shAvgXp: r.sh_avg_xp,
    nullCount: r.null_count,
    softDeletedAt: r.soft_deleted_at ? new Date(r.soft_deleted_at) : null,
    tournamentWins: r.tournament_wins ?? 0,
    tournamentFeaturedWins: r.tournament_featured_wins ?? 0,
    tournamentBestTitle: r.tournament_best_title,
    tournamentBestAt: r.tournament_best_at
      ? new Date(r.tournament_best_at)
      : null,
    onslaughtBestTier: r.onslaught_best_tier,
    onslaughtBestRank: r.onslaught_best_rank,
    // Defaulted like the tournament counts above. The player CTE is a
    // `SELECT *`, so the column arrives on its own, and the column is NOT NULL
    // with a zero default; the guard is for the row that predates neither.
    onslaughtSeasons: r.onslaught_seasons ?? 0,
  };
}

function snapshotFromRaw(r: RawPlayerSnapshot): PlayerSnapshot {
  return {
    id: Number(r.id),
    playerId: Number(r.player_id),
    takenAt: new Date(r.taken_at),
    lastBattleAt: r.last_battle_at ? new Date(r.last_battle_at) : null,
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
    skirmishBattles: r.skirmish_battles == null ? null : Number(r.skirmish_battles),
    skirmishWins: r.skirmish_wins == null ? null : Number(r.skirmish_wins),
    skirmishLosses: r.skirmish_losses == null ? null : Number(r.skirmish_losses),
    skirmishDraws: r.skirmish_draws == null ? null : Number(r.skirmish_draws),
    skirmishSurvivedBattles: r.skirmish_survived_battles == null ? null : Number(r.skirmish_survived_battles),
    skirmishFrags: r.skirmish_frags == null ? null : Number(r.skirmish_frags),
    skirmishDamageDealt: r.skirmish_damage_dealt == null ? null : Number(r.skirmish_damage_dealt),
    skirmishSpotted: r.skirmish_spotted == null ? null : Number(r.skirmish_spotted),
    skirmishCapturePoints: r.skirmish_capture_points == null ? null : Number(r.skirmish_capture_points),
    skirmishDroppedCapturePoints: r.skirmish_dropped_capture_points == null ? null : Number(r.skirmish_dropped_capture_points),
    skirmishBattleAvgXp: r.skirmish_battle_avg_xp == null ? null : Number(r.skirmish_battle_avg_xp),
    fortifiedBattles: r.fortified_battles == null ? null : Number(r.fortified_battles),
    fortifiedWins: r.fortified_wins == null ? null : Number(r.fortified_wins),
    fortifiedLosses: r.fortified_losses == null ? null : Number(r.fortified_losses),
    fortifiedDraws: r.fortified_draws == null ? null : Number(r.fortified_draws),
    fortifiedSurvivedBattles: r.fortified_survived_battles == null ? null : Number(r.fortified_survived_battles),
    fortifiedFrags: r.fortified_frags == null ? null : Number(r.fortified_frags),
    fortifiedDamageDealt: r.fortified_damage_dealt == null ? null : Number(r.fortified_damage_dealt),
    fortifiedSpotted: r.fortified_spotted == null ? null : Number(r.fortified_spotted),
    fortifiedCapturePoints: r.fortified_capture_points == null ? null : Number(r.fortified_capture_points),
    fortifiedDroppedCapturePoints: r.fortified_dropped_capture_points == null ? null : Number(r.fortified_dropped_capture_points),
    fortifiedBattleAvgXp: r.fortified_battle_avg_xp == null ? null : Number(r.fortified_battle_avg_xp),
    epicBattles: r.epic_battles == null ? null : Number(r.epic_battles),
    epicWins: r.epic_wins == null ? null : Number(r.epic_wins),
    epicLosses: r.epic_losses == null ? null : Number(r.epic_losses),
    epicDraws: r.epic_draws == null ? null : Number(r.epic_draws),
    epicSurvivedBattles: r.epic_survived_battles == null ? null : Number(r.epic_survived_battles),
    epicFrags: r.epic_frags == null ? null : Number(r.epic_frags),
    epicDamageDealt: r.epic_damage_dealt == null ? null : Number(r.epic_damage_dealt),
    epicSpotted: r.epic_spotted == null ? null : Number(r.epic_spotted),
    epicCapturePoints: r.epic_capture_points == null ? null : Number(r.epic_capture_points),
    epicDroppedCapturePoints: r.epic_dropped_capture_points == null ? null : Number(r.epic_dropped_capture_points),
    epicBattleAvgXp: r.epic_battle_avg_xp == null ? null : Number(r.epic_battle_avg_xp),
    falloutBattles: r.fallout_battles == null ? null : Number(r.fallout_battles),
    falloutWins: r.fallout_wins == null ? null : Number(r.fallout_wins),
    falloutLosses: r.fallout_losses == null ? null : Number(r.fallout_losses),
    falloutDraws: r.fallout_draws == null ? null : Number(r.fallout_draws),
    falloutSurvivedBattles: r.fallout_survived_battles == null ? null : Number(r.fallout_survived_battles),
    falloutFrags: r.fallout_frags == null ? null : Number(r.fallout_frags),
    falloutDamageDealt: r.fallout_damage_dealt == null ? null : Number(r.fallout_damage_dealt),
    falloutSpotted: r.fallout_spotted == null ? null : Number(r.fallout_spotted),
    falloutCapturePoints: r.fallout_capture_points == null ? null : Number(r.fallout_capture_points),
    falloutDroppedCapturePoints: r.fallout_dropped_capture_points == null ? null : Number(r.fallout_dropped_capture_points),
    falloutBattleAvgXp: r.fallout_battle_avg_xp == null ? null : Number(r.fallout_battle_avg_xp),
    rankedBattles: r.ranked_battles == null ? null : Number(r.ranked_battles),
    rankedWins: r.ranked_wins == null ? null : Number(r.ranked_wins),
    rankedLosses: r.ranked_losses == null ? null : Number(r.ranked_losses),
    rankedDraws: r.ranked_draws == null ? null : Number(r.ranked_draws),
    rankedSurvivedBattles: r.ranked_survived_battles == null ? null : Number(r.ranked_survived_battles),
    rankedFrags: r.ranked_frags == null ? null : Number(r.ranked_frags),
    rankedDamageDealt: r.ranked_damage_dealt == null ? null : Number(r.ranked_damage_dealt),
    rankedSpotted: r.ranked_spotted == null ? null : Number(r.ranked_spotted),
    rankedCapturePoints: r.ranked_capture_points == null ? null : Number(r.ranked_capture_points),
    rankedDroppedCapturePoints: r.ranked_dropped_capture_points == null ? null : Number(r.ranked_dropped_capture_points),
    rankedBattleAvgXp: r.ranked_battle_avg_xp == null ? null : Number(r.ranked_battle_avg_xp),
    cwAbsoluteBattles: r.cw_absolute_battles == null ? null : Number(r.cw_absolute_battles),
    cwAbsoluteWins: r.cw_absolute_wins == null ? null : Number(r.cw_absolute_wins),
    cwAbsoluteLosses: r.cw_absolute_losses == null ? null : Number(r.cw_absolute_losses),
    cwAbsoluteDraws: r.cw_absolute_draws == null ? null : Number(r.cw_absolute_draws),
    cwAbsoluteSurvivedBattles: r.cw_absolute_survived_battles == null ? null : Number(r.cw_absolute_survived_battles),
    cwAbsoluteFrags: r.cw_absolute_frags == null ? null : Number(r.cw_absolute_frags),
    cwAbsoluteDamageDealt: r.cw_absolute_damage_dealt == null ? null : Number(r.cw_absolute_damage_dealt),
    cwAbsoluteSpotted: r.cw_absolute_spotted == null ? null : Number(r.cw_absolute_spotted),
    cwAbsoluteCapturePoints: r.cw_absolute_capture_points == null ? null : Number(r.cw_absolute_capture_points),
    cwAbsoluteDroppedCapturePoints: r.cw_absolute_dropped_capture_points == null ? null : Number(r.cw_absolute_dropped_capture_points),
    cwAbsoluteBattleAvgXp: r.cw_absolute_battle_avg_xp == null ? null : Number(r.cw_absolute_battle_avg_xp),
    cwChampionBattles: r.cw_champion_battles == null ? null : Number(r.cw_champion_battles),
    cwChampionWins: r.cw_champion_wins == null ? null : Number(r.cw_champion_wins),
    cwChampionLosses: r.cw_champion_losses == null ? null : Number(r.cw_champion_losses),
    cwChampionDraws: r.cw_champion_draws == null ? null : Number(r.cw_champion_draws),
    cwChampionSurvivedBattles: r.cw_champion_survived_battles == null ? null : Number(r.cw_champion_survived_battles),
    cwChampionFrags: r.cw_champion_frags == null ? null : Number(r.cw_champion_frags),
    cwChampionDamageDealt: r.cw_champion_damage_dealt == null ? null : Number(r.cw_champion_damage_dealt),
    cwChampionSpotted: r.cw_champion_spotted == null ? null : Number(r.cw_champion_spotted),
    cwChampionCapturePoints: r.cw_champion_capture_points == null ? null : Number(r.cw_champion_capture_points),
    cwChampionDroppedCapturePoints: r.cw_champion_dropped_capture_points == null ? null : Number(r.cw_champion_dropped_capture_points),
    cwChampionBattleAvgXp: r.cw_champion_battle_avg_xp == null ? null : Number(r.cw_champion_battle_avg_xp),
    cwMiddleBattles: r.cw_middle_battles == null ? null : Number(r.cw_middle_battles),
    cwMiddleWins: r.cw_middle_wins == null ? null : Number(r.cw_middle_wins),
    cwMiddleLosses: r.cw_middle_losses == null ? null : Number(r.cw_middle_losses),
    cwMiddleDraws: r.cw_middle_draws == null ? null : Number(r.cw_middle_draws),
    cwMiddleSurvivedBattles: r.cw_middle_survived_battles == null ? null : Number(r.cw_middle_survived_battles),
    cwMiddleFrags: r.cw_middle_frags == null ? null : Number(r.cw_middle_frags),
    cwMiddleDamageDealt: r.cw_middle_damage_dealt == null ? null : Number(r.cw_middle_damage_dealt),
    cwMiddleSpotted: r.cw_middle_spotted == null ? null : Number(r.cw_middle_spotted),
    cwMiddleCapturePoints: r.cw_middle_capture_points == null ? null : Number(r.cw_middle_capture_points),
    cwMiddleDroppedCapturePoints: r.cw_middle_dropped_capture_points == null ? null : Number(r.cw_middle_dropped_capture_points),
    cwMiddleBattleAvgXp: r.cw_middle_battle_avg_xp == null ? null : Number(r.cw_middle_battle_avg_xp),
  };
}

function tankSnapshotFromRaw(r: RawTankSnapshot): TankSnapshot {
  return {
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
    xp: r.xp == null ? null : Number(r.xp),
    markOfMastery: r.mark_of_mastery == null ? null : Number(r.mark_of_mastery),
    marksOnGun: r.marks_on_gun == null ? null : Number(r.marks_on_gun),
    // Unused by the player page's period rating diff.
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

  // Baseline snapshot for a period diff. The ORDER BY alone expresses the rule:
  // rows older than `interval` sort first (newest of them wins), and when the
  // player has been tracked for less than that window (no such row) it falls
  // through to the oldest snapshot we hold, otherwise a player with only a few
  // days of history would show a blank column instead of the games they played.
  //
  // There is deliberately no WHERE filter beyond `player_id`. The old clause also
  // OR-ed in `taken_at <= (latest snapshot's taken_at)`, but that is the max
  // taken_at by construction, so it is true for EVERY row. The predicate was a
  // no-op that, per tank, forced a correlated re-scan of the (unindexed) latest_*
  // CTE for every candidate row, i.e. an O(rows x tanks) blowup that dominated
  // the query for long-tracked players (hundreds of ms). Dropping it leaves the
  // exact same row set (verified: identical output for every player/interval),
  // orders it the same way, and removes the quadratic.
  const playerPeriodCte = (interval: string) => sql`
      SELECT * FROM ${playerSnapshots}
      WHERE player_id = (SELECT id FROM p)
      ORDER BY
        (taken_at < NOW() - ${interval}::interval) DESC,
        CASE WHEN taken_at < NOW() - ${interval}::interval THEN taken_at END DESC,
        taken_at ASC
      LIMIT 1
    `;

  // The tank side reads the player's tank snapshots ONCE (tank_scan) and picks,
  // per tank, the latest row plus each period's baseline via row_number() ranks
  // instead of four separate DISTINCT ON scans of the same partition. Measured
  // ~42% faster than the four-scan form (one heap scan, not four). It is a clear
  // win only because tank_scan projects the fourteen columns the page actually
  // reads: carrying `SELECT *` (~40 cols) through the four window sorts was a
  // net loss, as was stripping rank columns with `to_jsonb - key` per row.
  //
  // Baseline rule (same as the player snaps above): rows older than `interval`
  // rank first, newest of them winning; a player tracked for less than the window
  // falls through to their oldest snapshot (`rn = 1` on the tie-broken ASC tail),
  // never a blank column. rn_latest ranks by battles (monotonic per tank), so it
  // is the current per-tank row.
  const tankRank = (interval: string) => sql`
      row_number() OVER (
        PARTITION BY tank_id
        ORDER BY
          (taken_at < NOW() - ${interval}::interval) DESC,
          CASE WHEN taken_at < NOW() - ${interval}::interval THEN taken_at END DESC,
          taken_at ASC
      )`;
  // The exact columns tankSnapshotFromRaw consumes; keep in sync with it.
  const tankCols = sql`
      player_id, tank_id, taken_at, battles, wins, damage_dealt, spotted, frags,
      dropped_capture_points, radio_assisted_damage, track_assisted_damage, xp,
      mark_of_mastery, marks_on_gun`;
  const pickTanks = (rank: string) => sql`
      (SELECT json_agg(row_to_json(t))
       FROM (SELECT ${tankCols} FROM tank_scan WHERE ${sql.raw(rank)} = 1) t)`;

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
    tank_scan AS (
      SELECT ${tankCols},
        row_number() OVER (PARTITION BY tank_id ORDER BY taken_at DESC, battles DESC) AS rn_latest,
        ${tankRank("24 hours")} AS rn_24h,
        ${tankRank("7 days")} AS rn_7d,
        ${tankRank("30 days")} AS rn_30d
      FROM ${tankSnapshots}
      WHERE player_id = (SELECT id FROM p)
    ),
    snap_24h AS (${playerPeriodCte("24 hours")}),
    snap_7d AS (${playerPeriodCte("7 days")}),
    snap_30d AS (${playerPeriodCte("30 days")})
    SELECT
      (SELECT row_to_json(p.*) FROM p) AS player,
      (SELECT row_to_json(latest_snap.*) FROM latest_snap) AS latest_snapshot,
      ${pickTanks("rn_latest")} AS latest_tank_snapshots,
      (SELECT row_to_json(ch.*)
       FROM ${playerClanHistory} ch
       WHERE ch.account_id = ${accountIdClause}
       LIMIT 1) AS clan_history,
      (SELECT row_to_json(snap_24h.*) FROM snap_24h) AS snap_24h,
      (SELECT row_to_json(snap_7d.*) FROM snap_7d) AS snap_7d,
      (SELECT row_to_json(snap_30d.*) FROM snap_30d) AS snap_30d,
      ${pickTanks("rn_24h")} AS tanks_24h,
      ${pickTanks("rn_7d")} AS tanks_7d,
      ${pickTanks("rn_30d")} AS tanks_30d
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

  return tracedSync("transformInitial", () => ({
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
  }));
}
