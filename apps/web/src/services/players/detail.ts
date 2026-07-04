import { RatingMetric } from "@/constants/rating";
import {
  cwAbsoluteStatsFromSnapshot,
  cwChampionStatsFromSnapshot,
  cwMiddleStatsFromSnapshot,
  diffStats,
  diffStrongholdStats,
  epicStatsFromSnapshot,
  falloutStatsFromSnapshot,
  fortifiedStatsFromSnapshot,
  rankedStatsFromSnapshot,
  skirmishStatsFromSnapshot,
  statsFromSnapshot,
  type Stats,
  type StrongholdStats,
} from "@/services/players";
import {
  buildPlayerDerivedStats,
  type PeriodStats,
  type PlayerDerivedStats,
} from "@/services/players/derived-stats";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@/services/players/initial-data";
import { buildLiftDrag, type LiftDrag } from "@/services/players/lift-drag";
import {
  getRatingHistory,
  type RatingHistoryPoint,
} from "@/services/players/rating-history";
import { diffTanks, tankSnapshotsToTankStats } from "@/services/players/tanks";
import {
  buildPlayerVehicleRows,
  type PlayerVehicleRow,
} from "@/services/players/vehicles";
import type { Player, PlayerSnapshot } from "@/services/db/schema";
import type { Region } from "@unicum.gg/wargaming/region";
import type { PlayerClanHistoryFull } from "@/services/wargaming/wot/clans/player";
import { getVehicleEncyclopedia } from "@/services/wargaming/wot/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@/services/wargaming/wot/ratings";
import type { TankStats } from "@/services/wargaming/wot/tanks";

export type StrongholdPeriodStats = {
  h24: StrongholdStats | null;
  d7: StrongholdStats | null;
  d30: StrongholdStats | null;
};

export type StrongholdModeData = {
  current: StrongholdStats | null;
  periods: StrongholdPeriodStats;
};

// One entry per non-random game mode shown on the player page, keyed by the
// domain mode name (the WG snapshot column prefixes), not by UI tab id.
export type PlayerStrongholdModes = {
  skirmish: StrongholdModeData;
  fortified: StrongholdModeData;
  epic: StrongholdModeData;
  ranked: StrongholdModeData;
  fallout: StrongholdModeData;
  cwAbsolute: StrongholdModeData;
  cwChampion: StrongholdModeData;
  cwMiddle: StrongholdModeData;
};

// The player detail resource: everything the player page tabs render and the
// `GET /api/[region]/players/[nickname]` endpoint exposes. All tank-breakdown
// derivations (stats grid, lift/drag, vehicle rows) are computed here so the
// payload carries values, never the encyclopedia or expected-value tables.
// `liftDrag` and `ratingHistory` depend on the requested metric.
export type PlayerDetailData = {
  player: {
    accountId: number;
    nickname: string;
    createdAt: Date;
    lastBattleAt: Date;
    updatedAt: Date;
  };
  metric: RatingMetric;
  current: Stats;
  periods: PeriodStats;
  derived: PlayerDerivedStats;
  vehicles: PlayerVehicleRow[];
  liftDrag: LiftDrag | null;
  ratingHistory: RatingHistoryPoint[];
  clanHistory: PlayerClanHistoryFull;
  strongholds: PlayerStrongholdModes;
};

export const EMPTY_CLAN_HISTORY: PlayerClanHistoryFull = {
  currentStint: null,
  pastStints: [],
  totalClans: 0,
  timeInClansSeconds: 0,
};

/**
 * Assembles the player detail from already-resolved inputs. Shared by the
 * player page SSR (which resolves them via its stale-while-revalidate flow,
 * falling back to live WG fetches on a cold DB) and by `loadPlayerDetail`
 * below (DB-only path for the API), so both produce the exact same payload.
 */
export async function buildPlayerDetail(args: {
  region: Region;
  accountId: number;
  player: Player;
  latest: PlayerSnapshot;
  tanks: TankStats[];
  clanHistory: PlayerClanHistoryFull;
  initial: PlayerInitialData;
  metric: RatingMetric;
}): Promise<PlayerDetailData> {
  const { region, accountId, player, latest, tanks, clanHistory, initial, metric } =
    args;

  const [encyclopedia, wn8Expected, wnxExpected, ratingHistory] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      getRatingHistory(region, player.id, metric),
    ]);

  const current = statsFromSnapshot(latest);
  const periods: PeriodStats = {
    h24: initial.periodSnapshots.h24
      ? diffStats(current, statsFromSnapshot(initial.periodSnapshots.h24))
      : null,
    d7: initial.periodSnapshots.d7
      ? diffStats(current, statsFromSnapshot(initial.periodSnapshots.d7))
      : null,
    d30: initial.periodSnapshots.d30
      ? diffStats(current, statsFromSnapshot(initial.periodSnapshots.d30))
      : null,
  };
  const periodTanks = {
    h24:
      initial.periodTankSnapshots.h24.size > 0
        ? diffTanks(tanks, initial.periodTankSnapshots.h24)
        : null,
    d7:
      initial.periodTankSnapshots.d7.size > 0
        ? diffTanks(tanks, initial.periodTankSnapshots.d7)
        : null,
    d30:
      initial.periodTankSnapshots.d30.size > 0
        ? diffTanks(tanks, initial.periodTankSnapshots.d30)
        : null,
  };

  function mode(
    fromSnap: (s: PlayerSnapshot) => StrongholdStats | null,
  ): StrongholdModeData {
    const current = fromSnap(latest);
    function diffFor(snap: PlayerSnapshot | null): StrongholdStats | null {
      if (!current || !snap) return null;
      const past = fromSnap(snap);
      return past !== null ? diffStrongholdStats(current, past) : null;
    }
    return {
      current,
      periods: {
        h24: diffFor(initial.periodSnapshots.h24),
        d7: diffFor(initial.periodSnapshots.d7),
        d30: diffFor(initial.periodSnapshots.d30),
      },
    };
  }

  return {
    player: {
      accountId,
      nickname: player.nickname,
      createdAt: player.createdAt ?? new Date(0),
      lastBattleAt: player.lastBattleAt ?? new Date(0),
      updatedAt: player.lastSeenAt,
    },
    metric,
    current,
    periods,
    derived: buildPlayerDerivedStats(
      current,
      periods,
      tanks,
      periodTanks,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    ),
    vehicles: buildPlayerVehicleRows(
      tanks,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    ),
    liftDrag: buildLiftDrag(tanks, encyclopedia, wn8Expected, wnxExpected, metric),
    ratingHistory: ratingHistory.points,
    clanHistory,
    strongholds: {
      skirmish: mode(skirmishStatsFromSnapshot),
      fortified: mode(fortifiedStatsFromSnapshot),
      epic: mode(epicStatsFromSnapshot),
      ranked: mode(rankedStatsFromSnapshot),
      fallout: mode(falloutStatsFromSnapshot),
      cwAbsolute: mode(cwAbsoluteStatsFromSnapshot),
      cwChampion: mode(cwChampionStatsFromSnapshot),
      cwMiddle: mode(cwMiddleStatsFromSnapshot),
    },
  };
}

/**
 * DB-only loader for the player detail endpoint: serves whatever the tracker
 * has cached and never falls back to live WG fetches (page hits enqueue
 * refreshes; the API just reads). Returns null when the player is unknown or
 * has no snapshot yet.
 */
export async function loadPlayerDetail(
  region: Region,
  nickname: string,
  metric: RatingMetric,
): Promise<PlayerDetailData | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (!initial.player || !initial.latestSnapshot) return null;
  return buildPlayerDetail({
    region,
    accountId: initial.player.accountId,
    player: initial.player,
    latest: initial.latestSnapshot,
    tanks: tankSnapshotsToTankStats(initial.latestTankSnapshots),
    clanHistory: initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY,
    initial,
    metric,
  });
}
