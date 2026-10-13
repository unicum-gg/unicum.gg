import {
  RatingMetric,
  buildPlayerDerivedStats,
  type PeriodStats,
  type PlayerDerivedStats,
  buildLiftDrag,
  type LiftDrag,
  buildPlayerTankRows,
  type PlayerTankRow,
  type Player,
  type PlayerSnapshot,
  type PlayerClanHistoryFull,
  EMPTY_CLAN_HISTORY,
  type PlayerDetailData,
  type StrongholdModeData,
  lastBattleOrNull,
} from "@unicum.gg/shared";
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
  applyGarageMarks,
  recordCurrentSnapshot,
  skirmishStatsFromSnapshot,
  statsFromSnapshot,
  type Stats,
  type StrongholdStats,
} from "@unicum.gg/core/players";
import { tracedSync } from "@unicum.gg/core/lib/perf-trace";
import { isAccountPublicSupporter } from "@unicum.gg/core/subscription";
import {
  getAccountTwitchLogin,
  isAccountVerified,
} from "@unicum.gg/core/players/badges";
import { getPlayerNameHistory } from "@unicum.gg/core/players/name-history";
import { resolveAccountByNickname } from "@unicum.gg/core/players/resolve-account";
import {
  type PlayerInitialData,
  loadPlayerInitialData,
} from "@unicum.gg/core/players/initial-data";
import {
  getRatingHistory,
  type RatingHistoryPoint,
} from "@unicum.gg/core/players/rating-history";
import {
  diffTanks,
  tankSnapshotsToTankStats,
  type TankSnapshotMap,
} from "@unicum.gg/core/players/tanks";
import {
  loadPlayerClanHistoryFromWG,
  storePlayerClanHistory,
  withDisbandedFlags,
} from "@unicum.gg/core/players/clan-history";
import {
  getAccountWTR,
  getPlayerInfo,
} from "@unicum.gg/core/wargaming/wot/accounts";
import { getTanksStats } from "@unicum.gg/core/wargaming/wot/tanks";
import type { Region } from "@unicum.gg/wargaming";
import { countEarnedAchievements } from "@unicum.gg/core/players/achievements";
import { countPlayerTournaments } from "@unicum.gg/core/tournaments/read";
import { getVehicleEncyclopedia } from "@unicum.gg/core/wargaming/wot/tanks/encyclopedia";
import { getAllTankSpecs } from "@unicum.gg/core/wargaming/wot/tanks/specs";
import {
  getWN8ExpectedValues,
  getWNXExpectedValues,
} from "@unicum.gg/core/wargaming/wot/wn-expected";
import type { TankStats } from "@unicum.gg/core/wargaming/wot/tanks";
import { computePlayerValuation, type TankEconomics } from "@unicum.gg/shared";
import { loadPlayerGarage } from "@unicum.gg/core/players/garage";
import { buildPlayerMarkProgress, withTankMarkReach } from "@unicum.gg/shared";
import { getTankMoeByRegion } from "@unicum.gg/core/moe";

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
}): Promise<PlayerDetailData> {
  const { region, accountId, player, latest, tanks, initial } = args;

  const [
    // Whether each of those clans still exists is resolved here rather than
    // taken from the stored history, which was written whenever this player was
    // last refreshed and cannot know about a clan that ended since. In the
    // parallel block because this is the busiest endpoint on the site and the
    // lookup has nothing to wait for.
    clanHistory,
    encyclopedia,
    wn8Expected,
    wnxExpected,
    ratingHistory,
    specs,
    isSupporter,
    nameHistory,
    isVerified,
    twitchLogin,
    achievementCount,
    tournamentCount,
    moeThresholds,
    garage,
  ] = await Promise.all([
    withDisbandedFlags(region, args.clanHistory),
    getVehicleEncyclopedia(region),
    getWN8ExpectedValues(),
    getWNXExpectedValues(),
    getRatingHistory(region, player.id),
    getAllTankSpecs(),
    isAccountPublicSupporter(region, accountId),
    getPlayerNameHistory(region, accountId),
    isAccountVerified(region, accountId),
    getAccountTwitchLogin(region, accountId),
    // Distinct medals earned, for the "Achievements (N)" tab label. Reads the
    // denormalised column rather than counting the jsonb map, so it is a
    // primary-key lookup on a table with one row per player, and it rides in
    // the parallel batch the detail already makes.
    countEarnedAchievements(region, player.id),
    // Tournaments entered, for the "Tournaments (N)" tab label. An index scan
    // on the roster's `account_id`, so it rides this batch like the medal count
    // above rather than making the tab's own read happen on every section.
    countPlayerTournaments(region, accountId),
    // The region's Marks of Excellence bars, for the profile's marks panel.
    // A cached catalogue read (see `@unicum.gg/core/moe`), so it rides here
    // without adding a scan per profile view.
    getTankMoeByRegion(region),
    // The account's own garage, when its owner has signed in with Wargaming.net
    // ID. A primary-key range read on a table holding a few hundred rows per
    // verified account, so it rides this batch rather than costing the profile
    // a round trip, and it answers null for everybody else.
    loadPlayerGarage(region, accountId),
  ]);
  // Lite economics map for the vehicle rows' account-value fields.
  const economics = new Map<number, TankEconomics>();
  for (const [tankId, s] of specs) {
    economics.set(tankId, {
      buyGold: s.buyGold,
      buyCredits: s.buyCredits,
      researchXp: s.researchXp,
    });
  }

  const current = statsFromSnapshot(latest);
  // Account-stat diff for a period. An empty first fetch (battles === 0, the
  // poisoned snapshot where WG's aggregate lagged) means the whole period is
  // "everything since we started tracking" = the lifetime total, so return
  // `current`. This keeps the rating-delta rows honest too: the poisoned
  // baseline carried a non-zero wtr (e.g. 8313) even with battles 0, so a naive
  // diff showed a partial change (wtr 10072 - 8313 = +1759) instead of the real
  // +10072. Legit players have battles > 0 at first fetch, so this only fires on
  // the artifact.
  function periodDiff(baseline: PlayerSnapshot | null): typeof current | null {
    if (!baseline) return null;
    if (baseline.battles === 0) return current;
    return diffStats(current, statsFromSnapshot(baseline));
  }
  const periods: PeriodStats = {
    h24: periodDiff(initial.periodSnapshots.h24),
    d7: periodDiff(initial.periodSnapshots.d7),
    d30: periodDiff(initial.periodSnapshots.d30),
  };
  // Per-tank diff for a period. When the account baseline is an *empty* first
  // fetch (battles === 0 — a poisoned snapshot where WG's `statistics.all`
  // aggregate lagged the per-tank data at first sight), the account rows already
  // read as the lifetime total (subtracting zero), but the per-tank baseline
  // caught a battle or two, so a naive tank diff would drop them and make the
  // derived stats (combined dmg, WN8, WNX) disagree with the account rows for the
  // same column. Treat such a period as "= lifetime" for the tanks too (return
  // the full `tanks`), keeping the column internally consistent. Legit players
  // always have battles > 0 at first fetch, so this only fires on that artifact.
  function periodTankDiff(
    baseline: PlayerSnapshot | null,
    baselineTanks: (typeof initial.periodTankSnapshots)["d30"],
  ): typeof tanks | null {
    if (!baseline) return null;
    if (baseline.battles === 0) return tanks;
    return baselineTanks.size > 0 ? diffTanks(tanks, baselineTanks) : null;
  }
  const periodTanks = {
    h24: periodTankDiff(
      initial.periodSnapshots.h24,
      initial.periodTankSnapshots.h24,
    ),
    d7: periodTankDiff(
      initial.periodSnapshots.d7,
      initial.periodTankSnapshots.d7,
    ),
    d30: periodTankDiff(
      initial.periodSnapshots.d30,
      initial.periodTankSnapshots.d30,
    ),
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

  const derived = tracedSync("derivedStats", () =>
    buildPlayerDerivedStats(
      current,
      periods,
      tanks,
      periodTanks,
      encyclopedia,
      wn8Expected,
      wnxExpected,
    ),
  );
  // Where each vehicle's own combined damage sits against the region's mark
  // bars, attached to the rows rather than computed twice: the panel's reach
  // list and the Tanks tab's mark column are the same arithmetic asked of
  // different subsets, and two of it is two answers waiting to disagree.
  const recent = recentTankStats(
    tanks,
    initial.periodSnapshots.d30,
    initial.periodTankSnapshots.d30,
  );
  const vehicles = tracedSync("tankRows", () =>
    withTankMarkReach(
      buildPlayerTankRows(
        tanks,
        encyclopedia,
        wn8Expected,
        wnxExpected,
        economics,
        garage?.tankIds ?? null,
      ),
      tanks,
      recent,
      moeThresholds,
    ),
  );

  // Marks, mastery and the vehicles playing above their gun. Pure arithmetic
  // over rows the payload already holds: `vehicles` carries the marks, the
  // badges and the mark reach attached above.
  const markProgress = tracedSync("markProgress", () =>
    buildPlayerMarkProgress(vehicles),
  );

  return {
    player: {
      accountId,
      nickname: player.nickname,
      createdAt: player.createdAt ?? new Date(0),
      lastBattleAt: lastBattleOrNull(player.lastBattleAt),
      updatedAt: player.lastSeenAt,
    },
    nameHistory,
    isSupporter,
    isVerified,
    twitchLogin,
    // Straight off the player row, written when a tournament settles.
    tournamentWins: player.tournamentWins,
    tournamentFeaturedWins: player.tournamentFeaturedWins,
    tournamentBestTitle: player.tournamentBestTitle,
    // Likewise, written by the Onslaught crest pass. The profile header draws
    // its own badge row rather than going through `PlayerBadges`, so the crest
    // has to reach it through the payload like the tournament one beside it.
    onslaughtBestTier: player.onslaughtBestTier,
    onslaughtBestRank: player.onslaughtBestRank,
    onslaughtSeasons: player.onslaughtSeasons,
    current,
    periods,
    derived,
    tankCount: vehicles.length,
    achievementCount,
    tournamentCount,
    valuation: computePlayerValuation(vehicles, region, garage?.verifiedAt),
    markProgress,
    liftDrag: tracedSync("liftDrag", () => ({
      wn7: buildLiftDrag(
        tanks,
        encyclopedia,
        wn8Expected,
        wnxExpected,
        RatingMetric.Wn7,
      ),
      wn8: buildLiftDrag(
        tanks,
        encyclopedia,
        wn8Expected,
        wnxExpected,
        RatingMetric.Wn8,
      ),
      wnx: buildLiftDrag(
        tanks,
        encyclopedia,
        wn8Expected,
        wnxExpected,
        RatingMetric.Wnx,
      ),
    })),
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
): Promise<PlayerDetailData | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (!initial.player || !initial.latestSnapshot) return null;
  // The fleet's marks over the snapshots', because a snapshot only carries
  // what was true the last time that tank was played. See `applyGarageMarks`.
  const detailTanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  await applyGarageMarks(region, initial.player.accountId, detailTanks);
  return buildPlayerDetail({
    region,
    accountId: initial.player.accountId,
    player: initial.player,
    latest: initial.latestSnapshot,
    tanks: detailTanks,
    clanHistory: initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY,
    initial,
  });
}

/**
 * The per-tank form of the last 30 days, or null when there is no such thing.
 *
 * What the mark estimate compares against: Wargaming scores a mark on a rolling
 * window of recent battles, so a 30-day average is the closer analogue of it
 * than a career one. Null is returned rather than the lifetime array, in three
 * cases that all mean the same thing: no baseline, a baseline holding no tanks,
 * and the poisoned first snapshot (`battles === 0`, where WG's aggregate lagged
 * the per-tank data at first sight) whose diff IS the lifetime total. Labelling
 * a career average as 30-day form is the one mistake here that cannot be seen
 * in the output.
 */
function recentTankStats(
  tanks: TankStats[],
  baseline: PlayerSnapshot | null,
  baselineTanks: TankSnapshotMap,
): TankStats[] | null {
  if (!baseline || baseline.battles === 0) return null;
  return baselineTanks.size > 0 ? diffTanks(tanks, baselineTanks) : null;
}

/**
 * Loader for the on-demand per-tank list endpoint (the heavy `vehicles` array
 * that used to ride along in the detail payload). Resolves the player from the
 * DB, loads the latest per-tank snapshots and builds the rows the exact same way
 * `buildPlayerDetail` does. DB-only (no live WG fetch): the detail endpoint
 * already resolves/records cold accounts, so by the time the Tanks section is
 * opened the player is tracked. Returns null when the player is unknown.
 */
export async function loadPlayerTanks(
  region: Region,
  nickname: string,
): Promise<PlayerTankRow[] | null> {
  const initial = await loadPlayerInitialData(region, { nickname });
  if (!initial.player) return null;

  const tanks = tankSnapshotsToTankStats(initial.latestTankSnapshots);
  await applyGarageMarks(region, initial.player.accountId, tanks);
  const [encyclopedia, wn8Expected, wnxExpected, specs, garage, moeThresholds] =
    await Promise.all([
      getVehicleEncyclopedia(region),
      getWN8ExpectedValues(),
      getWNXExpectedValues(),
      getAllTankSpecs(),
      loadPlayerGarage(region, initial.player.accountId),
      // The region's mark bars, for the mark column. A cached catalogue read
      // like the detail endpoint's, so the heaviest list we serve pays nothing
      // for it, and the table is where the reader asks "which of these could I
      // mark" in the first place.
      getTankMoeByRegion(region),
    ]);
  const economics = new Map<number, TankEconomics>();
  for (const [tankId, s] of specs) {
    economics.set(tankId, {
      buyGold: s.buyGold,
      buyCredits: s.buyCredits,
      researchXp: s.researchXp,
    });
  }
  return withTankMarkReach(
    buildPlayerTankRows(
      tanks,
      encyclopedia,
      wn8Expected,
      wnxExpected,
      economics,
      garage?.tankIds ?? null,
    ),
    tanks,
    recentTankStats(
      tanks,
      initial.periodSnapshots.d30,
      initial.periodTankSnapshots.d30,
    ),
    moeThresholds,
  );
}

export enum PlayerDetailLiveStatus {
  /** Full detail payload available. */
  Found = "found",
  /** WG resolves the nickname but the account is locked (info is null). */
  Locked = "locked",
  /** WG doesn't know the nickname on this region. */
  Unknown = "unknown",
}

export type PlayerDetailLiveResult =
  | { status: PlayerDetailLiveStatus.Found; detail: PlayerDetailData }
  | {
      status: PlayerDetailLiveStatus.Locked;
      accountId: number;
      nickname: string;
    }
  | { status: PlayerDetailLiveStatus.Unknown };

/**
 * Stale-while-revalidate loader for the player detail endpoint (the flow the
 * player page used to run inline). DB first: a player with at least one
 * snapshot renders immediately from cache (a missing clan history backfills in
 * the background and LiveSync refetches when it lands). On a cold DB, resolve the
 * account on WG, fetch live, and record a snapshot, which also starts tracking
 * the player. `Locked` when WG resolves the nickname but returns no account
 * data (an account locked by Wargaming), `Unknown` when nothing resolves the
 * nickname at all.
 *
 * Which account a nickname names is `resolveAccountByNickname`'s answer, past
 * names included. A cold assembly runs only for a name somebody carries TODAY:
 * a past one is served from what we already hold, or not at all.
 */
export async function loadPlayerDetailLive(
  region: Region,
  nickname: string,
): Promise<PlayerDetailLiveResult> {
  // Who this nickname belongs to, and what we already hold about them. The
  // four sources and the order they are asked in live in `resolve-account`.
  const resolved = await resolveAccountByNickname(region, nickname);
  if (resolved === null) return { status: PlayerDetailLiveStatus.Unknown };
  const { accountId, initial } = resolved;
  const resolvedNickname = resolved.nickname;

  if (initial.player && initial.latestSnapshot) {
    // Cache hit. A stub clan history backfills in the background; LiveSync's
    // SSE triggers a refetch once it is stored.
    if (!initial.clanHistory) {
      void loadPlayerClanHistoryFromWG(region, accountId)
        .then((history) => storePlayerClanHistory(region, accountId, history))
        .catch((err) =>
          console.error("[bg] backfill clan history failed:", err),
        );
    }
    return {
      status: PlayerDetailLiveStatus.Found,
      detail: await buildPlayerDetail({
        region,
        accountId,
        player: initial.player,
        latest: initial.latestSnapshot,
        tanks: tracedSync("toTankStats", () =>
          tankSnapshotsToTankStats(initial.latestTankSnapshots),
        ),
        clanHistory: initial.clanHistory?.data ?? EMPTY_CLAN_HISTORY,
        initial,
      }),
    };
  }

  // Cold DB: fetch everything live from WG and record a snapshot (which also
  // starts tracking the player). Account info comes first and gates the rest:
  // WG's account/list can resolve a nickname whose account/info is null
  // (wiped/deleted account), and the other fetches are expensive to run for
  // nothing (the portal clan history retries through a 1 RPS limiter, which
  // once stretched this 404 to minutes).
  const info = await getPlayerInfo(region, accountId);
  if (!info) {
    return {
      status: PlayerDetailLiveStatus.Locked,
      accountId,
      nickname: resolvedNickname ?? nickname,
    };
  }
  const [fetchedTanks, fetchedWtr, fetchedClanHistory] = await Promise.all([
    getTanksStats(region, accountId).catch((err) => {
      console.warn("[player detail] getTanksStats failed:", err);
      return [] as TankStats[];
    }),
    getAccountWTR(region, accountId).catch(() => null),
    loadPlayerClanHistoryFromWG(region, accountId).catch((err) => {
      console.error("[player detail] loadPlayerClanHistoryFromWG failed:", err);
      return EMPTY_CLAN_HISTORY;
    }),
  ]);

  const { player, latest } = await recordCurrentSnapshot(
    region,
    info,
    fetchedWtr,
    fetchedTanks,
  );
  void storePlayerClanHistory(region, accountId, fetchedClanHistory).catch(
    (err) => console.error("[bg] storePlayerClanHistory failed:", err),
  );

  return {
    status: PlayerDetailLiveStatus.Found,
    detail: await buildPlayerDetail({
      region,
      accountId,
      player,
      latest,
      tanks: fetchedTanks,
      clanHistory: fetchedClanHistory,
      initial,
    }),
  };
}
