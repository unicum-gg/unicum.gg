import { RatingMetric, buildPlayerDerivedStats, type PeriodStats, type PlayerDerivedStats, buildLiftDrag, type LiftDrag, buildPlayerVehicleRows, type PlayerVehicleRow, type Player, type PlayerSnapshot, type PlayerClanHistoryFull, EMPTY_CLAN_HISTORY, type PlayerDetailData, type StrongholdModeData } from "@unicum.gg/shared";
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
} from "@unicum.gg/core/players";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@unicum.gg/core/players/initial-data";
import {
  getRatingHistory,
  type RatingHistoryPoint,
} from "@unicum.gg/core/players/rating-history";
import { diffTanks, tankSnapshotsToTankStats } from "@unicum.gg/core/players/tanks";
import type { Region } from "@unicum.gg/wargaming";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";

// The client-safe shapes (`PlayerDetailData`, the stronghold-mode types) and
// the pure `EMPTY_CLAN_HISTORY` const live in `@unicum.gg/shared/players/detail`;
// re-exported here for back-compat. This module keeps the server-side builders.
export * from "@unicum.gg/shared/players/detail";

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
